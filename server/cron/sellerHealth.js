const Order = require('../models/Order');
const Seller = require('../models/Seller');
const Product = require('../models/Product');
const { sendOTP } = require('../utils/email'); // reuse transporter
const { logActivity } = require('../utils/audit');

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
    console.log(`[AutoCancel] Order ${order.orderNumber} cancelled (seller: ${order.sellerId})`);
  }

  if (cancelled > 0) {
    console.log(`[AutoCancel] Cancelled ${cancelled} unshipped orders`);
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

  console.log(`[Metrics] Updated metrics for ${updated} sellers`);
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
      console.log(`[AutoSuspend] Suspended seller ${seller.sellerProfile.businessName}: ${reason}`);
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
      console.log(`[Warning] Warned seller ${seller.sellerProfile.businessName}: ${warnReason}`);
    }
  }

  console.log(`[AutoSuspend] Suspended: ${suspended}, Warned: ${warned}`);
  return { suspended, warned };
}

// ==================== UPDATE SELLER LAST ACTIVE ====================
async function updateSellerLastActive(sellerId) {
  await Seller.findByIdAndUpdate(sellerId, {
    'sellerProfile.lastActiveAt': new Date()
  });
}

// ==================== RUN ALL CRONS ====================
async function runAllCrons() {
  console.log(`\n[Cron] Running seller health checks at ${new Date().toISOString()}`);
  try {
    await autoCancelUnshippedOrders();
    await calculateSellerMetrics();
    await autoSuspendBadSellers();
    console.log('[Cron] All checks complete\n');
  } catch (err) {
    console.error('[Cron] Error:', err.message);
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
    if (sent > 0) console.log(`[Cron] Sent ${sent} review request emails`);
  } catch (err) {
    console.error('[Cron] Review request email error:', err.message);
  }
}

// ==================== SCHEDULE ====================
function startCronJobs() {
  // Run auto-cancel every hour
  setInterval(autoCancelUnshippedOrders, 60 * 60 * 1000);

  // Run metrics + auto-suspend every 6 hours
  setInterval(async () => {
    await calculateSellerMetrics();
    await autoSuspendBadSellers();
  }, 6 * 60 * 60 * 1000);

  // Send review request emails every 12 hours
  setInterval(sendReviewRequestEmails, 12 * 60 * 60 * 1000);

  // Run initial check after 30 seconds (let server start)
  setTimeout(runAllCrons, 30 * 1000);

  console.log('[Cron] Seller health cron jobs scheduled');
}

module.exports = {
  startCronJobs,
  runAllCrons,
  autoCancelUnshippedOrders,
  calculateSellerMetrics,
  autoSuspendBadSellers,
  updateSellerLastActive
};
