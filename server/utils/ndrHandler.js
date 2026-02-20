/**
 * NDR (Non-Delivery Report) Handler
 *
 * Called by the Shiprocket webhook when a delivery attempt fails (status 21 "Undelivered").
 * Does NOT cancel the order — the courier will re-attempt or eventually RTO.
 * Only sends notifications to seller and customer so they can take action.
 */

const { createNotification } = require('./notify');
const { logActivity } = require('./audit');
const logger = require('./logger');

async function handleNDR(shipment, order) {
  if (!order) {
    logger.warn(`[NDR] No order found for shipment ${shipment._id}`);
    return;
  }

  logger.info(`[NDR] Delivery failed for order ${order.orderNumber} (AWB: ${shipment.awbCode})`);

  // Notify seller to contact customer or take action
  if (order.sellerId) {
    createNotification({
      userId: order.sellerId.toString(),
      userRole: 'seller',
      type: 'shipping_update',
      title: `Delivery Failed: Order #${order.orderNumber}`,
      message: `Delivery attempt failed for AWB ${shipment.awbCode || 'N/A'}. The courier will retry. Contact the customer if needed.`,
      link: '/seller/orders',
      metadata: { orderId: order._id.toString(), awb: shipment.awbCode, reason: 'ndr' }
    });
  }

  // Notify customer about failed delivery attempt
  if (order.customerId) {
    createNotification({
      userId: order.customerId.toString(),
      userRole: 'customer',
      type: 'shipping_update',
      title: `Delivery Attempt Failed: Order #${order.orderNumber}`,
      message: 'A delivery attempt was unsuccessful. The courier will try again. Please ensure someone is available to receive the package.',
      link: `/orders/${order._id}`,
      metadata: { orderId: order._id.toString(), awb: shipment.awbCode, reason: 'ndr' }
    });
  }

  logActivity({
    domain: 'shipping',
    action: 'ndr_delivery_failed',
    actorRole: 'system',
    actorId: null,
    actorEmail: 'shiprocket-webhook',
    targetType: 'Order',
    targetId: order._id,
    message: `Delivery attempt failed for order ${order.orderNumber} (AWB: ${shipment.awbCode || 'N/A'})`
  });
}

module.exports = { handleNDR };
