const express = require('express');
const crypto = require('crypto');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Seller = require('../models/Seller');
const { getCashfreeOrder, getCashfreePayments } = require('../config/cashfree');
const { sendOrderConfirmation } = require('../utils/email');
const { logActivity } = require('../utils/audit');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * Verify Cashfree webhook signature.
 * Uses HMAC-SHA256 with the client secret.
 */
function verifyCashfreeSignature(req) {
  const timestamp = req.headers['x-webhook-timestamp'];
  const signature = req.headers['x-webhook-signature'];
  const rawBody = req.rawBody;
  const secret = process.env.CASHFREE_SECRET_KEY;

  if (!timestamp || !signature || !rawBody || !secret) return false;

  const signaturePayload = timestamp + rawBody;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('base64');

  return signature === expectedSignature;
}

/**
 * Process confirmed payment for orders matching a Cashfree order ID.
 * Shared logic used by the webhook handler.
 */
async function processPaymentConfirmation(cashfreeOrderId) {
  // Verify with Cashfree API as an additional check
  const cfOrder = await getCashfreeOrder(cashfreeOrderId);
  if (cfOrder.order_status !== 'PAID') {
    return { processed: false, reason: `Order status is ${cfOrder.order_status}` };
  }

  const payments = await getCashfreePayments(cashfreeOrderId);
  const successPayment = payments.find(p => p.payment_status === 'SUCCESS');

  const orders = await Order.find({ cashfreeOrderId });
  if (!orders.length) {
    return { processed: false, reason: 'No matching orders found' };
  }

  // Verify payment amount matches order total (prevent amount tampering)
  const expectedTotal = orders.reduce((s, o) => s + o.totalAmount, 0);
  const paidAmount = parseFloat(cfOrder.order_amount);
  if (Math.abs(paidAmount - expectedTotal) > 1) { // 1 rupee tolerance for rounding
    logger.error(`[Payment] AMOUNT MISMATCH: paid ${paidAmount}, expected ${expectedTotal}, cashfreeOrderId=${cashfreeOrderId}`);
    logActivity({ domain: 'payment', action: 'payment_amount_mismatch', actorRole: 'system', actorId: null, actorEmail: 'cashfree-webhook', targetType: 'Order', targetId: orders[0]._id, message: `Amount mismatch: paid ${paidAmount}, expected ${expectedTotal}` });
    return { processed: false, reason: `Amount mismatch: paid ${paidAmount}, expected ${expectedTotal}` };
  }

  let processedCount = 0;

  for (const order of orders) {
    if (order.paymentStatus === 'paid') continue; // Already processed

    order.paymentStatus = 'paid';
    order.status = 'confirmed';
    order.cashfreePaymentId = successPayment?.cf_payment_id?.toString() || '';
    order.paidAt = new Date();
    await order.save();
    processedCount++;

    // Atomic stock decrement
    for (const item of order.items) {
      const updated = await Product.findOneAndUpdate(
        { _id: item.productId, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity, orderCount: item.quantity } },
        { new: true }
      );
      if (!updated) {
        logger.error(`[Webhook][Stock] Insufficient stock for product ${item.productId}, order ${order.orderNumber}`);
      }
    }

    // Update seller stats
    await Seller.findByIdAndUpdate(order.sellerId, {
      $inc: { 'sellerProfile.totalSales': order.totalAmount, 'sellerProfile.totalOrders': 1 }
    });

    // Send emails (non-blocking)
    try {
      await sendOrderConfirmation(order.customerEmail, order, 'customer');
      const seller = await Seller.findById(order.sellerId);
      if (seller) await sendOrderConfirmation(seller.email, order, 'seller');
    } catch (emailErr) {
      logger.error('[Webhook] Email send error:', emailErr.message);
    }

    logActivity({
      domain: 'payment',
      action: 'webhook_payment_confirmed',
      actorRole: 'system',
      actorId: null,
      actorEmail: 'cashfree-webhook',
      targetType: 'Order',
      targetId: order._id,
      message: `Webhook confirmed payment for order ${order.orderNumber}`
    });
  }

  // Track coupon usage (with race-condition-safe predicate)
  const couponCode = orders.find(o => o.couponCode)?.couponCode;
  if (couponCode && processedCount > 0) {
    try {
      const Coupon = require('../models/Coupon');
      const customerId = orders[0].customerId;
      const couponDoc = await Coupon.findOne({ code: couponCode });
      if (couponDoc) {
        const result = await Coupon.findOneAndUpdate(
          { code: couponCode, usedCount: { $lt: couponDoc.usageLimit } },
          { $inc: { usedCount: 1 }, $addToSet: { usedBy: customerId } }
        );
        if (!result) logger.warn('[Webhook][Coupon] Usage limit exceeded for', couponCode);
      }
    } catch (couponErr) {
      logger.error('[Webhook][Coupon] Failed to track usage:', couponErr.message);
    }
  }

  return { processed: true, processedCount, totalOrders: orders.length };
}

/**
 * POST /api/payments/cashfree/webhook
 * Receives Cashfree server-to-server payment notifications.
 * Must respond with 200 quickly; Cashfree retries on non-200.
 */
router.post('/cashfree/webhook', async (req, res) => {
  try {
    // Verify signature
    if (!verifyCashfreeSignature(req)) {
      logger.error('[Cashfree Webhook] Invalid signature');
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const { data, type } = req.body;

    // We only care about payment success events
    if (type !== 'PAYMENT_SUCCESS_WEBHOOK' && type !== 'ORDER_PAID') {
      // Acknowledge but don't process
      return res.status(200).json({ message: 'Event type not handled' });
    }

    const cashfreeOrderId = data?.order?.order_id;
    if (!cashfreeOrderId) {
      return res.status(400).json({ message: 'Missing order_id in webhook payload' });
    }

    const result = await processPaymentConfirmation(cashfreeOrderId);

    if (result.processed) {
      logger.info(`[Cashfree Webhook] Processed payment for ${cashfreeOrderId}: ${result.processedCount}/${result.totalOrders} orders updated`);
    } else {
      logger.info(`[Cashfree Webhook] Skipped ${cashfreeOrderId}: ${result.reason}`);
    }

    // Always return 200 to prevent retries
    res.status(200).json({ message: 'Webhook received', ...result });
  } catch (err) {
    logger.error('[Cashfree Webhook] Error:', err.message);
    // Return 200 even on error to prevent infinite retries for malformed data
    // Real errors (like DB issues) will be retried by Cashfree if we return 500
    res.status(500).json({ message: 'Webhook processing failed' });
  }
});

module.exports = router;
