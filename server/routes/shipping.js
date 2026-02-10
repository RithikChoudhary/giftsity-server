const express = require('express');
const Order = require('../models/Order');
const Shipment = require('../models/Shipment');
const User = require('../models/User');
const router = express.Router();

// NOTE: All seller-facing shipping routes (serviceability, create, assign-courier,
// pickup, track, label) have been moved to server-seller/routes/seller.js.
// This file only contains the Shiprocket webhook endpoint which must stay
// on the main server (port 5000) since it's called by Shiprocket externally.

// POST /api/shipping/webhook - Shiprocket status updates
router.post('/webhook', async (req, res) => {
  try {
    const { awb, current_status, shipment_id, etd } = req.body;

    const shipment = await Shipment.findOne({
      $or: [{ awbCode: awb }, { shiprocketShipmentId: shipment_id?.toString() }]
    });
    if (!shipment) return res.status(200).json({ message: 'ok' }); // Don't fail

    // Map Shiprocket status to our status
    const statusMap = {
      'PICKUP SCHEDULED': 'pickup_scheduled',
      'PICKED UP': 'picked_up',
      'IN TRANSIT': 'in_transit',
      'OUT FOR DELIVERY': 'out_for_delivery',
      'DELIVERED': 'delivered',
      'RTO INITIATED': 'rto',
      'CANCELED': 'cancelled'
    };

    const mappedStatus = statusMap[current_status] || shipment.status;
    shipment.status = mappedStatus;
    if (etd) shipment.estimatedDelivery = new Date(etd);
    shipment.statusHistory.push({ status: mappedStatus, description: current_status });
    await shipment.save();

    // Update order status
    const order = await Order.findById(shipment.orderId);
    if (order) {
      if (mappedStatus === 'delivered') {
        order.status = 'delivered';
        order.deliveredAt = new Date();
        await User.findByIdAndUpdate(order.sellerId, { $inc: { 'sellerProfile.deliveredOrders': 1 } });
      } else if (mappedStatus === 'rto' || mappedStatus === 'cancelled') {
        await User.findByIdAndUpdate(order.sellerId, { $inc: { 'sellerProfile.failedOrders': 1 } });
      }
      if (shipment.awbCode) {
        order.trackingInfo.trackingNumber = shipment.awbCode;
        order.trackingInfo.courierName = shipment.courierName;
      }
      await order.save();
    }

    res.json({ message: 'ok' });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(200).json({ message: 'ok' }); // Always return 200 for webhooks
  }
});

module.exports = router;
