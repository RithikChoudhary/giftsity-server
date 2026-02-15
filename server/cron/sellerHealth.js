const cron = require('node-cron');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Seller = require('../models/Seller');
const Product = require('../models/Product');
const { sendOTP } = require('../utils/email'); // reuse transporter
const { logActivity } = require('../utils/audit');
const logger = require('../utils/logger');

// ==================== CONFIG ====================
const SHIP_DEADLINE_HOURS = 48;        // Orders must be shipped within 48h
const AUTO_CANCEL_HOURS = 72;          // Auto-cancel unshipped orders after 72h
const FULFILLMENT_WARN_THRESHOLD = 75; // Warn at 75%
const FULFILLMENT_SUSPEND_THRESHOLD = 50; // Auto-suspend at 50%
const CANCEL_RATE_WARN_THRESHOLD = 3;  // Warn at 3%
const CANCEL_RATE_SUSPEND_THRESHOLD = 5; // Auto-suspend at 5%
const HEALTH_SCORE_SUSPEND_THRESHOLD = 40; // Auto-suspend below 40
const METRICS_LOOKBACK_DAYS = 30;      // Calculate over last 30 days
const MIN_ORDERS_FOR_METRICS = 3;      // Need at least 3 orders to judge

// ==================== AUTO-CANCEL UNSHIPPED ORDERS ====================
async function autoCancelUnshippedOrders() {
  const cutoff = new Date(Date.now() - AUTO_CANCEL_HOURS * 60 * 60 * 1000);

  const staleOrders = await Order.find({
    status: { $in: ['confirmed', 'processing'] },
    paymentStatus: 'paid',
    createdAt: { $lt: cutoff }
  });

  let cancelled = 0;
  for (const order of staleOrders) {
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = `Auto-cancelled: not shipped within ${AUTO_CANCEL_HOURS} hours`;
    order.paymentStatus = 'refunded';
    await order.save();

    // Restore stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity, orderCount: -item.quantity }
      });
    }

    // Track failed order for seller
    await Seller.findByIdAndUpdate(order.sellerId, {
      $inc: { 'sellerProfile.failedOrders': 1 }
    });

    cancelled++;
    logActivity({ domain: 'cron', action: 'order_auto_cancelled', actorRole: 'system', targetType: 'Order', targetId: order._id, message: `Order ${order.orderNumber} auto-cancelled (not shipped within ${AUTO_CANCEL_HOURS}h)`, metadata: { sellerId: order.sellerId.toString(), orderNumber: order.orderNumber } });
    logger.info(`[AutoCancel] Order ${order.orderNumber} cancelled (seller: ${order.sellerId})`);
  }

  if (cancelled > 0) {
    logger.info(`[AutoCancel] Cancelled ${cancelled} unshipped orders`);
  }
  return cancelled;
}

// ==================== AUTO-CANCEL UNPAID ORDERS ====================
const UNPAID_CANCEL_MINUTES = 10; // Cancel unpaid orders after 10 minutes

async function autoCancelUnpaidOrders() {
  const cutoff = new Date(Date.now() - UNPAID_CANCEL_MINUTES * 60 * 1000);

  const unpaidOrders = await Order.find({
    status: 'pending',
    paymentStatus: 'pending',
    createdAt: { $lt: cutoff }
  });

  let cancelled = 0;
  for (const order of unpaidOrders) {
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = `Auto-cancelled: payment not completed within ${UNPAID_CANCEL_MINUTES} minutes`;
    await order.save();

    // Restore stock for each item
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity }
      });
    }

    cancelled++;
    logger.info(`[AutoCancelUnpaid] Order ${order.orderNumber} cancelled (no payment after ${UNPAID_CANCEL_MINUTES}m)`);
  }

  if (cancelled > 0) {
    logger.info(`[AutoCancelUnpaid] Cancelled ${cancelled} unpaid orders`);
  }
  return cancelled;
}

// ==================== CALCULATE SELLER METRICS ====================
async function calculateSellerMetrics() {
  const lookbackDate = new Date(Date.now() - METRICS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const lateThreshold = SHIP_DEADLINE_HOURS * 60 * 60 * 1000; // ms

  const sellers = await Seller.find({ status: { $in: ['active', 'suspended'] } });

  let updated = 0;
  for (const seller of sellers) {
    const orders = await Order.find({
      sellerId: seller._id,
      paymentStatus: { $in: ['paid', 'refunded'] },
      createdAt: { $gte: lookbackDate }
    });

    if (orders.length < MIN_ORDERS_FOR_METRICS) {
      // Not enough orders to calculate meaningful metrics
      seller.sellerProfile.metrics = {
        ...seller.sellerProfile.metrics,
        lastCalculatedAt: new Date()
      };
      await seller.save();
      continue;
    }

    const totalOrders = orders.length;

    // Seller-cancelled orders (cancelled by seller or auto-cancelled for not shipping)
    const cancelledOrders = orders.filter(o =>
      o.status === 'cancelled' && o.cancelReason && !o.cancelReason.includes('customer')
    );
    const cancelRate = (cancelledOrders.length / totalOrders) * 100;

    // Shipped orders
    const shippedOrders = orders.filter(o =>
      ['shipped', 'delivered'].includes(o.status) || o.trackingInfo?.shippedAt
    );

    // Late shipments (shipped after deadline)
    const lateShipments = shippedOrders.filter(o => {
      if (!o.trackingInfo?.shippedAt) return false;
      const shipTime = new Date(o.trackingInfo.shippedAt) - new Date(o.createdAt);
      return shipTime > lateThreshold;
    });
    const lateShipmentRate = shippedOrders.length > 0
      ? (lateShipments.length / shippedOrders.length) * 100
      : 0;

    // Fulfillment rate = (shipped + delivered) / (total - customer-cancelled)
    const customerCancelled = orders.filter(o =>
      o.status === 'cancelled' && o.cancelReason?.includes('customer')
    ).length;
    const actionableOrders = totalOrders - customerCancelled;
    const fulfilledOrders = shippedOrders.length;
    const fulfillmentRate = actionableOrders > 0
      ? (fulfilledOrders / actionableOrders) * 100
      : 100;

    // Average ship time (hours)
    const shipTimes = shippedOrders
      .filter(o => o.trackingInfo?.shippedAt)
      .map(o => (new Date(o.trackingInfo.shippedAt) - new Date(o.createdAt)) / (1000 * 60 * 60));
    const avgShipTimeHours = shipTimes.length > 0
      ? shipTimes.reduce((a, b) => a + b, 0) / shipTimes.length
      : 0;

    // Composite health score (0-100)
    // Weighted: fulfillment 40%, cancel rate 30%, late shipment 20%, avg ship time 10%
    const fulfillmentScore = Math.min(fulfillmentRate, 100);
    const cancelScore = Math.max(0, 100 - cancelRate * 10); // 10% cancel = 0 score
    const lateScore = Math.max(0, 100 - lateShipmentRate * 4); // 25% late = 0
    const speedScore = avgShipTimeHours <= 24 ? 100 : Math.max(0, 100 - (avgShipTimeHours - 24) * 2);

    const healthScore = Math.round(
      fulfillmentScore * 0.4 +
      cancelScore * 0.3 +
      lateScore * 0.2 +
      speedScore * 0.1
    );

    seller.sellerProfile.metrics = {
      fulfillmentRate: Math.round(fulfillmentRate * 10) / 10,
      cancelRate: Math.round(cancelRate * 10) / 10,
      lateShipmentRate: Math.round(lateShipmentRate * 10) / 10,
      avgShipTimeHours: Math.round(avgShipTimeHours * 10) / 10,
      healthScore,
      warningCount: seller.sellerProfile.metrics?.warningCount || 0,
      lastCalculatedAt: new Date()
    };

    await seller.save();
    updated++;
  }

  logger.info(`[Metrics] Updated metrics for ${updated} sellers`);
  return updated;
}

// ==================== AUTO-SUSPEND LOW HEALTH SELLERS ====================
async function autoSuspendBadSellers() {
  const sellers = await Seller.find({
    status: 'active',
    'sellerProfile.metrics.lastCalculatedAt': { $ne: null }
  });

  let suspended = 0;
  let warned = 0;

  for (const seller of sellers) {
    const m = seller.sellerProfile.metrics;
    if (!m || !m.lastCalculatedAt) continue;

    let shouldSuspend = false;
    let reason = '';

    // Check thresholds
    if (m.fulfillmentRate < FULFILLMENT_SUSPEND_THRESHOLD) {
      shouldSuspend = true;
      reason = `Fulfillment rate dropped to ${m.fulfillmentRate}% (minimum: ${FULFILLMENT_SUSPEND_THRESHOLD}%)`;
    } else if (m.cancelRate > CANCEL_RATE_SUSPEND_THRESHOLD) {
      shouldSuspend = true;
      reason = `Cancellation rate reached ${m.cancelRate}% (maximum: ${CANCEL_RATE_SUSPEND_THRESHOLD}%)`;
    } else if (m.healthScore < HEALTH_SCORE_SUSPEND_THRESHOLD) {
      shouldSuspend = true;
      reason = `Health score dropped to ${m.healthScore}/100 (minimum: ${HEALTH_SCORE_SUSPEND_THRESHOLD})`;
    }

    if (shouldSuspend) {
      seller.status = 'suspended';
      seller.sellerProfile.suspensionType = 'auto';
      seller.sellerProfile.suspensionReason = reason;
      seller.sellerProfile.suspensionRemovalRequested = false;
      seller.sellerProfile.suspensionRemovalReason = '';
      await seller.save();

      // Hide all products
      await Product.updateMany({ sellerId: seller._id }, { isActive: false });

      suspended++;
      logActivity({ domain: 'cron', action: 'seller_auto_suspended', actorRole: 'system', targetType: 'Seller', targetId: seller._id, message: `Seller ${seller.sellerProfile.businessName} auto-suspended: ${reason}`, metadata: { businessName: seller.sellerProfile.businessName, healthScore: m.healthScore } });
      logger.info(`[AutoSuspend] Suspended seller ${seller.sellerProfile.businessName}: ${reason}`);
      continue;
    }

    // Check warning thresholds
    let shouldWarn = false;
    let warnReason = '';
    if (m.fulfillmentRate < FULFILLMENT_WARN_THRESHOLD) {
      shouldWarn = true;
      warnReason = `Fulfillment rate is ${m.fulfillmentRate}%. Below ${FULFILLMENT_SUSPEND_THRESHOLD}% will result in suspension.`;
    } else if (m.cancelRate > CANCEL_RATE_WARN_THRESHOLD) {
      shouldWarn = true;
      warnReason = `Cancellation rate is ${m.cancelRate}%. Above ${CANCEL_RATE_SUSPEND_THRESHOLD}% will result in suspension.`;
    }

    if (shouldWarn) {
      seller.sellerProfile.metrics.warningCount = (m.warningCount || 0) + 1;
      await seller.save();
      warned++;
      logger.info(`[Warning] Warned seller ${seller.sellerProfile.businessName}: ${warnReason}`);
    }
  }

  logger.info(`[AutoSuspend] Suspended: ${suspended}, Warned: ${warned}`);
  return { suspended, warned };
}

// ==================== UPDATE SELLER LAST ACTIVE ====================
async function updateSellerLastActive(sellerId) {
  await Seller.findByIdAndUpdate(sellerId, {
    'sellerProfile.lastActiveAt': new Date()
  });
}

// ==================== AUTO CALCULATE PAYOUTS ====================
async function autoCalculatePayouts() {
  try {
    const PlatformSettings = require('../models/PlatformSettings');
    const SellerPayout = require('../models/SellerPayout');

    const settings = await PlatformSettings.getSettings();
    const schedule = settings.payoutSchedule || 'biweekly';

    // Determine if we should run today based on schedule
    const now = new Date();
    const dayOfMonth = now.getDate();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...

    let shouldRun = false;
    if (schedule === 'weekly') {
      shouldRun = dayOfWeek === 1; // Every Monday
    } else if (schedule === 'biweekly') {
      shouldRun = dayOfMonth === 1 || dayOfMonth === 15; // 1st and 15th
    } else if (schedule === 'monthly') {
      shouldRun = dayOfMonth === 1; // 1st of month
    }

    if (!shouldRun) {
      logger.info(`[Payout Cron] Skipping - not a payout day (schedule: ${schedule}, day: ${dayOfMonth})`);
      return { calculated: 0, skipped: true };
    }

    // Find all delivered, paid orders that haven't been included in a payout
    const orders = await Order.find({
      paymentStatus: 'paid',
      status: 'delivered',
      payoutStatus: 'pending'
    });

    if (!orders.length) {
      logger.info('[Payout Cron] No pending orders to process');
      return { calculated: 0 };
    }

    // Group by seller
    const sellerMap = {};
    for (const order of orders) {
      const sid = order.sellerId.toString();
      if (!sellerMap[sid]) sellerMap[sid] = [];
      sellerMap[sid].push(order);
    }

    const periodEnd = new Date();
    const periodStart = new Date();
    if (schedule === 'weekly') periodStart.setDate(periodStart.getDate() - 7);
    else if (schedule === 'biweekly') periodStart.setDate(periodStart.getDate() - 15);
    else periodStart.setMonth(periodStart.getMonth() - 1);

    let calculated = 0;
    let onHold = 0;
    let duplicatesSkipped = 0;

    for (const [sellerId, sellerOrders] of Object.entries(sellerMap)) {
      const seller = await Seller.findById(sellerId);
      if (!seller) continue;

      // Duplicate protection: skip if a payout already exists for overlapping period
      const existingPayout = await SellerPayout.findOne({
        sellerId,
        periodStart: { $lte: periodEnd },
        periodEnd: { $gte: periodStart }
      });
      if (existingPayout) {
        logger.warn(`[Payout Cron] Duplicate skipped for seller ${sellerId}, existing payout ${existingPayout._id}`);
        duplicatesSkipped++;
        continue;
      }

      const totalSales = sellerOrders.reduce((s, o) => s + (o.itemTotal || o.totalAmount), 0);
      const commissionDeducted = sellerOrders.reduce((s, o) => s + (o.commissionAmount || 0), 0);
      const gatewayFeesDeducted = sellerOrders.reduce((s, o) => s + (o.paymentGatewayFee || 0), 0);
      const shippingDeducted = sellerOrders.reduce((s, o) => {
        return s + (o.shippingPaidBy === 'seller' ? (o.shippingCost || 0) : 0);
      }, 0);
      const sellerAmountBeforeShipping = sellerOrders.reduce((s, o) => s + (o.sellerAmount || 0), 0);
      const netPayout = Math.max(0, sellerAmountBeforeShipping - shippingDeducted);

      // Check bank details
      const bank = seller.sellerProfile?.bankDetails;
      const hasBankDetails = bank?.accountHolderName && bank?.accountNumber && bank?.ifscCode && bank?.bankName;

      const payoutData = {
        sellerId,
        periodStart,
        periodEnd,
        periodLabel: `${periodStart.toLocaleDateString('en-IN')} - ${periodEnd.toLocaleDateString('en-IN')}`,
        orderIds: sellerOrders.map(o => o._id),
        orderCount: sellerOrders.length,
        totalSales,
        commissionDeducted,
        gatewayFeesDeducted,
        shippingDeducted,
        netPayout,
        status: hasBankDetails ? 'pending' : 'on_hold',
        holdReason: hasBankDetails ? '' : 'missing_bank_details',
        bankDetailsSnapshot: bank || {}
      };

      // Attempt transactional write; fall back to non-transactional if replica set unavailable
      let session = null;
      try {
        session = await mongoose.startSession();
        await session.withTransaction(async () => {
          const payout = new SellerPayout(payoutData);
          await payout.save({ session });
          await Order.updateMany(
            { _id: { $in: sellerOrders.map(o => o._id) } },
            { payoutStatus: 'included_in_payout', payoutId: payout._id },
            { session }
          );
        });
      } catch (txErr) {
        // If transactions are not supported (e.g. standalone MongoDB), fall back
        if (txErr.codeName === 'IllegalOperation' || txErr.message?.includes('transaction')) {
          logger.warn('[Payout Cron] Transactions not supported, falling back to non-transactional write');
          const payout = new SellerPayout(payoutData);
          await payout.save();
          await Order.updateMany(
            { _id: { $in: sellerOrders.map(o => o._id) } },
            { payoutStatus: 'included_in_payout', payoutId: payout._id }
          );
        } else {
          throw txErr; // re-throw unexpected errors
        }
      } finally {
        if (session) session.endSession();
      }

      if (hasBankDetails) calculated++;
      else onHold++;
    }

    logger.info(`[Payout Cron] Calculated ${calculated} payouts, ${onHold} on hold, ${duplicatesSkipped} duplicates skipped`);
    return { calculated, onHold, duplicatesSkipped };
  } catch (err) {
    logger.error('[Payout Cron] Error:', err.message);
    return { error: err.message };
  }
}

// ==================== RUN ALL CRONS ====================
async function runAllCrons() {
  logger.info(`\n[Cron] Running seller health checks at ${new Date().toISOString()}`);
  try {
    await autoCancelUnshippedOrders();
    await calculateSellerMetrics();
    await autoSuspendBadSellers();
    logger.info('[Cron] All checks complete\n');
  } catch (err) {
    logger.error('[Cron] Error:', err.message);
  }
}

// ==================== REVIEW REQUEST EMAILS ====================
async function sendReviewRequestEmails() {
  try {
    const { sendReviewRequestEmail } = require('../utils/email');
    // Find orders delivered ~2 days ago that haven't been reviewed
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const orders = await Order.find({
      status: 'delivered',
      deliveredAt: { $gte: threeDaysAgo, $lte: twoDaysAgo },
      customerEmail: { $ne: '' }
    }).limit(50);

    const Review = require('../models/Review');
    let sent = 0;
    for (const order of orders) {
      // Check if any item has been reviewed
      const existingReview = await Review.findOne({ orderId: order._id });
      if (existingReview) continue;

      try {
        await sendReviewRequestEmail(order.customerEmail, order);
        sent++;
      } catch (e) { /* skip failed emails */ }
    }
    if (sent > 0) logger.info(`[Cron] Sent ${sent} review request emails`);
  } catch (err) {
    logger.error('[Cron] Review request email error:', err.message);
  }
}

// ==================== SCHEDULE ====================
function startCronJobs() {
  // Auto-cancel unpaid orders every 5 minutes
  cron.schedule('*/5 * * * *', autoCancelUnpaidOrders);

  // Auto-cancel unshipped orders at the top of every hour
  cron.schedule('0 * * * *', autoCancelUnshippedOrders);

  // Metrics + auto-suspend every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    await calculateSellerMetrics();
    await autoSuspendBadSellers();
  });

  // Send review request emails every 12 hours
  cron.schedule('0 */12 * * *', sendReviewRequestEmails);

  // Payout calculation daily at midnight (function checks if it's a payout day)
  cron.schedule('0 0 * * *', autoCalculatePayouts);

  // Run initial checks after 30 seconds (let server start)
  setTimeout(runAllCrons, 30 * 1000);
  // Also run unpaid check shortly after start
  setTimeout(autoCancelUnpaidOrders, 15 * 1000);

  logger.info('[Cron] Seller health cron jobs scheduled (node-cron)');
}

module.exports = {
  startCronJobs,
  runAllCrons,
  autoCancelUnshippedOrders,
  autoCancelUnpaidOrders,
  calculateSellerMetrics,
  autoSuspendBadSellers,
  autoCalculatePayouts,
  updateSellerLastActive
};
