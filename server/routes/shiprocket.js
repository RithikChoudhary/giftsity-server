const express = require('express');
const Shipment = require('../models/Shipment');
const Order = require('../models/Order');
const logger = require('../utils/logger');
const { logActivity } = require('../utils/audit');
const { createNotification } = require('../utils/notify');
const { handleRTO } = require('../utils/rtoHandler');
const { handleNDR } = require('../utils/ndrHandler');
const router = express.Router();

/**
 * Map Shiprocket status codes / strings to internal shipment statuses.
 * Reference: https://apidocs.shiprocket.in/#tag/Tracking/webhook
 */
const STATUS_MAP = {
  // Shiprocket numeric status codes
  6: 'pickup_scheduled',     // Shipped / Ready to ship
  7: 'pickup_scheduled',     // Pickup Scheduled
  18: 'picked_up',           // Picked Up
  17: 'in_transit',          // In Transit
  38: 'in_transit',          // In Transit (alternate)
  19: 'out_for_delivery',    // Out for Delivery
  20: 'delivered',           // Delivered (lost/damaged excluded)
  // RTO
  9: 'rto',                  // RTO Initiated
  10: 'rto',                 // RTO Delivered
  14: 'rto',                 // RTO Acknowledged
  // Cancelled
  8: 'cancelled',            // Cancelled
  // NDR (Non-Delivery Report) — courier will re-attempt, don't cancel yet
  21: 'ndr',                 // Undelivered
};

/**
 * Map internal shipment status to order status
 */
function shipmentToOrderStatus(shipmentStatus) {
  switch (shipmentStatus) {
    case 'pickup_scheduled':
    case 'picked_up':
    case 'in_transit':
    case 'out_for_delivery':
      return 'shipped';
    case 'delivered':
      return 'delivered';
    case 'rto':
    case 'cancelled':
    case 'ndr':
      return null; // handled separately by rtoHandler / ndrHandler
    default:
      return null;
  }
}

/**
 * POST /api/shiprocket/webhook
 * Receives tracking updates from Shiprocket.
 * Shiprocket sends AWB-based tracking events.
 *
 * Shiprocket webhook payload example:
 * {
 *   "awb": "1234567890",
 *   "courier_name": "Delhivery",
 *   "current_status": "In Transit",
 *   "current_status_id": 17,
 *   "shipment_status": "In Transit",
 *   "shipment_status_id": 17,
 *   "scans": [...],
 *   "etd": "2026-02-15 23:59:59",
 *   "order_id": "SR-12345",
 *   "sr_order_id": 12345
 * }
 */
router.post('/webhook', async (req, res) => {
  try {
    // Verify webhook secret token to prevent forged requests
    const webhookSecret = process.env.SHIPROCKET_WEBHOOK_SECRET;
    if (webhookSecret && req.query.token !== webhookSecret) {
      logger.warn('[Shiprocket Webhook] Invalid or missing token');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const payload = req.body;
    logger.info('[Shiprocket Webhook] Received:', JSON.stringify(payload).substring(0, 500));

    // Extract key fields — Shiprocket can send different formats
    const awb = payload.awb || payload.awb_code || '';
    const srOrderId = (payload.sr_order_id || payload.order_id || '').toString();
    const currentStatusId = payload.current_status_id || payload.shipment_status_id;
    const currentStatus = payload.current_status || payload.shipment_status || '';
    const etd = payload.etd || '';
    const courierName = payload.courier_name || '';

    if (!awb && !srOrderId) {
      logger.warn('[Shiprocket Webhook] No AWB or order ID in payload');
      return res.status(200).json({ message: 'No identifiers found, ignored' });
    }

    // Find shipment by AWB or Shiprocket order ID
    let shipment;
    if (awb) {
      shipment = await Shipment.findOne({ awbCode: awb });
    }
    if (!shipment && srOrderId) {
      shipment = await Shipment.findOne({ shiprocketOrderId: srOrderId });
    }

    if (!shipment) {
      logger.warn(`[Shiprocket Webhook] No matching shipment for AWB=${awb}, SR Order=${srOrderId}`);
      return res.status(200).json({ message: 'Shipment not found, ignored' });
    }

    // Determine new internal status
    const newStatus = STATUS_MAP[currentStatusId] || null;
    const previousStatus = shipment.status;

    // Update shipment fields
    if (courierName && !shipment.courierName) {
      shipment.courierName = courierName;
    }
    if (awb && !shipment.awbCode) {
      shipment.awbCode = awb;
    }
    if (etd) {
      try { shipment.estimatedDelivery = new Date(etd); } catch (_) { /* ignore parse error */ }
    }

    // Push ALL scan events to history (deduplicate by timestamp+activity)
    const existingKeys = new Set(
      shipment.statusHistory.map(h => `${h.timestamp?.toISOString?.() || ''}|${h.description || ''}`)
    );

    const scans = payload.scans || [];
    if (scans.length > 0) {
      for (const scan of scans) {
        const ts = scan.date ? new Date(scan.date) : new Date();
        const desc = scan.activity || currentStatus;
        const key = `${ts.toISOString()}|${desc}`;
        if (!existingKeys.has(key)) {
          shipment.statusHistory.push({
            status: scan['sr-status-label'] || scan.status || currentStatus,
            description: desc,
            location: scan.location || '',
            timestamp: ts
          });
          existingKeys.add(key);
        }
      }
    } else {
      // No scans array — push a single event for the current status
      shipment.statusHistory.push({
        status: currentStatus,
        description: currentStatus,
        location: '',
        timestamp: new Date()
      });
    }

    // Only advance status forward (don't go backwards)
    const statusOrder = ['created', 'pickup_scheduled', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'ndr', 'rto', 'cancelled'];
    if (newStatus) {
      const currentIdx = statusOrder.indexOf(previousStatus);
      const newIdx = statusOrder.indexOf(newStatus);
      if (newIdx > currentIdx || newStatus === 'rto' || newStatus === 'cancelled' || newStatus === 'ndr') {
        shipment.status = newStatus;

        // Set specific date fields
        if (newStatus === 'picked_up') shipment.pickedUpAt = new Date();
        if (newStatus === 'pickup_scheduled') shipment.pickupScheduledAt = new Date();
      }
    }

    await shipment.save();

    // Update order status if applicable
    const orderStatus = shipmentToOrderStatus(shipment.status);
    if (orderStatus) {
      const order = await Order.findById(shipment.orderId);
      if (order && order.status !== orderStatus && order.status !== 'delivered') {
        order.status = orderStatus;
        if (orderStatus === 'shipped') {
          order.trackingInfo = {
            courierName: shipment.courierName || courierName,
            trackingNumber: shipment.awbCode || awb,
            shippedAt: order.trackingInfo?.shippedAt || new Date(),
            estimatedDelivery: shipment.estimatedDelivery || null
          };
        }
        if (orderStatus === 'delivered') {
          order.deliveredAt = new Date();
        }
        if (!order.statusHistory) order.statusHistory = [];
        order.statusHistory.push({ status: orderStatus, timestamp: new Date(), changedByRole: 'system', note: `Shiprocket webhook (AWB: ${awb})` });
        await order.save();

        // Notify customer about delivery status
        if (orderStatus === 'delivered') {
          createNotification({
            userId: order.customerId.toString(), userRole: 'customer',
            type: 'order_delivered', title: `Order #${order.orderNumber} delivered`,
            message: 'Your order has been delivered!',
            link: `/orders/${order._id}`, metadata: { orderId: order._id.toString() }
          });
        } else if (orderStatus === 'shipped') {
          createNotification({
            userId: order.customerId.toString(), userRole: 'customer',
            type: 'order_shipped', title: `Order #${order.orderNumber} shipped`,
            message: `Your order is on the way (AWB: ${awb})`,
            link: `/orders/${order._id}`, metadata: { orderId: order._id.toString() }
          });
        }

        logActivity({
          domain: 'shipping',
          action: 'shiprocket_status_update',
          actorRole: 'system',
          actorId: null,
          actorEmail: 'shiprocket-webhook',
          targetType: 'Order',
          targetId: order._id,
          message: `Shiprocket updated order ${order.orderNumber} to ${orderStatus} (AWB: ${awb})`
        });
      }
    }

    // Handle RTO / NDR — these don't change order status via shipmentToOrderStatus,
    // so we handle them separately with dedicated handlers
    if (shipment.status === 'rto' && previousStatus !== 'rto') {
      try {
        const order = await Order.findById(shipment.orderId);
        if (order) await handleRTO(shipment, order);
      } catch (rtoErr) {
        logger.error(`[Shiprocket Webhook] RTO handler error: ${rtoErr.message}`);
      }
    } else if (shipment.status === 'ndr' && previousStatus !== 'ndr') {
      try {
        const order = await Order.findById(shipment.orderId);
        if (order) await handleNDR(shipment, order);
      } catch (ndrErr) {
        logger.error(`[Shiprocket Webhook] NDR handler error: ${ndrErr.message}`);
      }
    }

    logger.info(`[Shiprocket Webhook] Updated shipment ${shipment._id}: ${previousStatus} → ${shipment.status}`);
    res.status(200).json({ message: 'Webhook processed' });
  } catch (err) {
    logger.error('[Shiprocket Webhook] Error:', err.message);
    // Always return 200 to prevent Shiprocket from retrying
    res.status(200).json({ message: 'Error processing webhook' });
  }
});

module.exports = router;
