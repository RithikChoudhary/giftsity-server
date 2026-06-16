const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Seller = require('../models/Seller');
const ReturnRequest = require('../models/ReturnRequest');
const { verifyPayment, verifyResponseHash } = require('../config/payu');
const { sendOrderConfirmation } = require('../utils/email');
const { logActivity } = require('../utils/audit');
const logger = require('../utils/logger');
const router = express.Router();

// PayU posts back as application/x-www-form-urlencoded (payment events) or
// application/json (refund / dispute events), so accept both content types.
const payuBodyParser = [
  express.json({ limit: '1mb' }),
  express.urlencoded({ extended: false, limit: '1mb' })
];

function firstClientUrl() {
  return (process.env.CLIENT_URL || '').split(',')[0].trim() || 'http://localhost:5173';
}

/**
 * Process confirmed payment for orders matching a PayU txnid (= our order number).
 * Re-verifies server-to-server with PayU before marking anything paid.
 * Shared by the webhook handler.
 */
async function processPaymentConfirmation(txnid) {
  // Re-verify with PayU API as an additional check (anti-tampering)
  const verification = await verifyPayment(txnid);
  if (!verification.found || verification.status !== 'success') {
    return { processed: false, reason: `PayU status is ${verification.status}` };
  }

  const orders = await Order.find({ cashfreeOrderId: txnid });
  if (!orders.length) {
    return { processed: false, reason: 'No matching orders found' };
  }

  // Verify payment amount matches order total (prevent amount tampering)
  const expectedTotal = orders.reduce((s, o) => s + o.totalAmount, 0);
  const paidAmount = verification.amount;
  if (Math.abs(paidAmount - expectedTotal) > 1) { // 1 rupee tolerance for rounding
    logger.error(`[Payment] AMOUNT MISMATCH: paid ${paidAmount}, expected ${expectedTotal}, txnid=${txnid}`);
    logActivity({ domain: 'payment', action: 'payment_amount_mismatch', actorRole: 'system', actorId: null, actorEmail: 'payu-webhook', targetType: 'Order', targetId: orders[0]._id, message: `Amount mismatch: paid ${paidAmount}, expected ${expectedTotal}` });
    return { processed: false, reason: `Amount mismatch: paid ${paidAmount}, expected ${expectedTotal}` };
  }

  let processedCount = 0;

  for (const order of orders) {
    if (order.paymentStatus === 'paid') continue; // Already processed

    order.paymentStatus = 'paid';
    order.status = 'confirmed';
    order.cashfreePaymentId = verification.mihpayid || '';
    order.paidAt = new Date();
    await order.save();
    processedCount++;

    // Stock was already reserved at order creation time.
    // Only increment orderCount now that payment is confirmed.
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { orderCount: item.quantity }
      });
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
      actorEmail: 'payu-webhook',
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
 * POST /api/payments/payu/return
 * PayU redirects the browser here via a form POST to surl/furl after checkout.
 * We verify the response hash, then 302-redirect the browser into the SPA,
 * which calls verify-payment to finalize the order.
 *
 * udf1 carries the return context: 'corporate' routes to the corporate SPA,
 * anything else routes to the customer storefront.
 */
router.post('/payu/return', payuBodyParser, async (req, res) => {
  const body = req.body || {};
  const txnid = body.txnid || '';
  const status = (body.status || '').toLowerCase();
  const context = body.udf1 || 'customer';

  const clientUrl = firstClientUrl();
  const basePath = context === 'corporate' ? '/corporate/orders' : '/orders';

  try {
    const hashValid = verifyResponseHash(body);
    if (!hashValid) {
      logger.error(`[PayU Return] Invalid hash for txnid=${txnid}`);
      return res.redirect(`${clientUrl}${basePath}?payu_status=invalid`);
    }

    const redirectStatus = status === 'success' ? 'success' : 'failure';
    return res.redirect(`${clientUrl}${basePath}?txnid=${encodeURIComponent(txnid)}&payu_status=${redirectStatus}`);
  } catch (err) {
    logger.error('[PayU Return] Error:', err.message);
    return res.redirect(`${clientUrl}${basePath}?payu_status=error`);
  }
});

/**
 * Handle a PayU "Refund" webhook (JSON payload, no hash signature).
 * We reconcile against our own records using `token` (= our refundId) and
 * `merchantTxnId` (= our txnid), so only records we generated are touched.
 *
 * Payload: { action: 'refund', status: 'success'|'failure', merchantTxnId,
 *            token, mihpayid, request_id, amt, remark, key, ... }
 */
async function handleRefundWebhook(body) {
  const token = String(body.token || '').trim();
  const txnid = String(body.merchantTxnId || '').trim();
  const status = String(body.status || '').toLowerCase();
  const mihpayid = String(body.mihpayid || '').trim();

  if (!token && !txnid) {
    return { processed: false, reason: 'Missing token and merchantTxnId' };
  }

  const order = token
    ? (await Order.findOne({ refundId: token })) || (await Order.findOne({ cashfreeOrderId: txnid }))
    : await Order.findOne({ cashfreeOrderId: txnid });

  if (order) {
    if (status === 'success') {
      order.paymentStatus = 'refunded';
      if (mihpayid && !order.cashfreePaymentId) order.cashfreePaymentId = mihpayid;
    } else if (status === 'failure') {
      order.paymentStatus = 'refund_pending';
      logger.warn(`[PayU Refund Webhook] Refund failed for order ${order.orderNumber}: ${body.remark || ''}`);
    }
    await order.save();
    logActivity({ domain: 'payment', action: 'refund_webhook', actorRole: 'system', actorId: null, actorEmail: 'payu-webhook', targetType: 'Order', targetId: order._id, message: `Refund ${status} for order ${order.orderNumber} (token ${token})` });
  }

  // Reconcile a linked return request, if any
  if (token) {
    const returnReq = await ReturnRequest.findOne({ refundId: token });
    if (returnReq && status === 'success' && returnReq.status !== 'refunded') {
      returnReq.status = 'refunded';
      if (!returnReq.statusHistory) returnReq.statusHistory = [];
      returnReq.statusHistory.push({ status: 'refunded', timestamp: new Date(), note: 'PayU refund confirmed via webhook' });
      await returnReq.save();
    }
  }

  return { processed: true, orderFound: !!order, status };
}

/**
 * POST /api/payments/payu/webhook
 * PayU server-to-server notification. Handles three dashboard event types:
 *  - Payment (Successful/Failed): urlencoded with reverse hash
 *  - Refund: JSON ({ action: 'refund', ... }), no hash
 *  - Dispute: JSON, acknowledged only for now
 * Must always respond 200 quickly so PayU does not retry endlessly.
 */
router.post('/payu/webhook', payuBodyParser, async (req, res) => {
  try {
    const body = req.body || {};
    const action = String(body.action || '').toLowerCase();

    // Refund event (JSON)
    if (action === 'refund') {
      const result = await handleRefundWebhook(body);
      logger.info(`[PayU Refund Webhook] ${result.reason || `order ${result.orderFound ? 'updated' : 'not found'}, status=${result.status}`}`);
      return res.status(200).json({ message: 'Refund webhook received', ...result });
    }

    // Dispute event (JSON) -- acknowledge only
    if (action === 'dispute' || req.headers['x-payu-dispute-webhook-signature-v2']) {
      logger.info('[PayU Dispute Webhook] Received dispute notification');
      return res.status(200).json({ message: 'Dispute webhook acknowledged' });
    }

    // Payment event (urlencoded with hash)
    if (!verifyResponseHash(body)) {
      logger.error('[PayU Webhook] Invalid signature');
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const txnid = body.txnid;
    if (!txnid) {
      return res.status(400).json({ message: 'Missing txnid in webhook payload' });
    }

    if ((body.status || '').toLowerCase() !== 'success') {
      return res.status(200).json({ message: 'Event not handled' });
    }

    const result = await processPaymentConfirmation(txnid);

    if (result.processed) {
      logger.info(`[PayU Webhook] Processed payment for ${txnid}: ${result.processedCount}/${result.totalOrders} orders updated`);
    } else {
      logger.info(`[PayU Webhook] Skipped ${txnid}: ${result.reason}`);
    }

    res.status(200).json({ message: 'Webhook received', ...result });
  } catch (err) {
    logger.error('[PayU Webhook] Error:', err.message);
    res.status(200).json({ message: 'Webhook processing failed', error: err.message });
  }
});

module.exports = router;
