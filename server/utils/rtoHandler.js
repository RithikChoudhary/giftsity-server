/**
 * RTO (Return to Origin) Handler
 *
 * Called by the Shiprocket webhook when a shipment enters RTO status.
 * Auto-cancels the order, restores stock, initiates refund, and notifies the customer.
 * Uses existing 'cancelled' order status — no new enum values needed.
 */

const Product = require('../models/Product');
const { createRefund, getCashfreeOrder } = require('../config/cashfree');
const { sendCancellationEmail } = require('./email');
const { createNotification } = require('./notify');
const { logActivity } = require('./audit');
const logger = require('./logger');

async function handleRTO(shipment, order) {
  if (!order || order.status === 'cancelled' || order.status === 'refunded') {
    logger.info(`[RTO] Order ${order?.orderNumber || 'unknown'} already ${order?.status}, skipping`);
    return;
  }

  logger.info(`[RTO] Processing RTO for order ${order.orderNumber} (shipment ${shipment._id})`);

  order.status = 'cancelled';
  order.cancelledAt = new Date();
  order.cancelReason = 'Return to Origin (RTO) — shipment returned by courier';
  if (!order.statusHistory) order.statusHistory = [];
  order.statusHistory.push({
    status: 'cancelled',
    timestamp: new Date(),
    changedByRole: 'system',
    note: `RTO: shipment ${shipment.awbCode || shipment._id} returned to origin`
  });

  // Restore product stock
  for (const item of order.items) {
    const stockInc = { stock: item.quantity };
    if (order.paymentStatus === 'paid') stockInc.orderCount = -item.quantity;
    await Product.findByIdAndUpdate(item.productId, { $inc: stockInc });
  }

  // Initiate refund if payment was completed
  if (order.paymentStatus === 'paid' && order.cashfreeOrderId) {
    try {
      let refundAmount = order.totalAmount;
      try {
        const cfOrderData = await getCashfreeOrder(order.cashfreeOrderId);
        if (cfOrderData.order_amount) {
          refundAmount = Math.min(order.totalAmount, parseFloat(cfOrderData.order_amount));
        }
      } catch (cfErr) {
        logger.warn(`[RTO] Could not verify Cashfree amount: ${cfErr.message}`);
      }
      const refundId = `refund_rto_${order.orderNumber}_${Date.now()}`;
      await createRefund({
        orderId: order.cashfreeOrderId,
        refundAmount,
        refundId,
        refundNote: 'Order cancelled — RTO (shipment returned to origin)'
      });
      order.paymentStatus = 'refunded';
      order.refundId = refundId;
      logger.info(`[RTO] Refund ${refundId} initiated for order ${order.orderNumber}`);
    } catch (refundErr) {
      logger.error(`[RTO] Refund failed for ${order.orderNumber}: ${refundErr.message}`);
      order.paymentStatus = 'refund_pending';
    }
  }

  await order.save();

  // Notify customer
  if (order.customerId) {
    createNotification({
      userId: order.customerId.toString(),
      userRole: 'customer',
      type: 'order_cancelled',
      title: `Order #${order.orderNumber} — Shipment Returned`,
      message: 'Your shipment was returned to the seller. A refund has been initiated.',
      link: `/orders/${order._id}`,
      metadata: { orderId: order._id.toString(), reason: 'rto' }
    });
  }

  // Notify seller
  if (order.sellerId) {
    createNotification({
      userId: order.sellerId.toString(),
      userRole: 'seller',
      type: 'order_cancelled',
      title: `RTO: Order #${order.orderNumber}`,
      message: `Shipment ${shipment.awbCode || ''} was returned to origin. Order has been auto-cancelled.`,
      link: '/seller/orders',
      metadata: { orderId: order._id.toString(), reason: 'rto' }
    });
  }

  // Send cancellation email
  try {
    if (order.customerEmail) await sendCancellationEmail(order.customerEmail, order);
  } catch (emailErr) {
    logger.error(`[RTO] Cancellation email failed: ${emailErr.message}`);
  }

  logActivity({
    domain: 'shipping',
    action: 'rto_auto_cancel',
    actorRole: 'system',
    actorId: null,
    actorEmail: 'shiprocket-webhook',
    targetType: 'Order',
    targetId: order._id,
    message: `Order ${order.orderNumber} auto-cancelled due to RTO (AWB: ${shipment.awbCode || 'N/A'})`
  });

  logger.info(`[RTO] Order ${order.orderNumber} cancelled, refund status: ${order.paymentStatus}`);
}

module.exports = { handleRTO };
