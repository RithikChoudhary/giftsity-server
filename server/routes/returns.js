const express = require('express');
const ReturnRequest = require('../models/ReturnRequest');
const Order = require('../models/Order');
const PlatformSettings = require('../models/PlatformSettings');
const { requireAuth } = require('../middleware/auth');
const { createNotification } = require('../utils/notify');
const { logActivity } = require('../utils/audit');
const { createRefund } = require('../config/cashfree');
const router = express.Router();

router.use(requireAuth);

// POST /api/returns -- customer creates a return request
router.post('/', async (req, res) => {
  try {
    const { orderId, items, type, reason, reasonDetails, images } = req.body;
    if (!orderId || !type || !reason) {
      return res.status(400).json({ message: 'orderId, type, and reason are required' });
    }
    if (!['return', 'exchange'].includes(type)) {
      return res.status(400).json({ message: 'Type must be return or exchange' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.customerId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not your order' });
    }
    if (order.status !== 'delivered') {
      return res.status(400).json({ message: 'Can only return delivered orders' });
    }
    if (order.returnStatus && order.returnStatus !== 'none') {
      return res.status(400).json({ message: 'Return already requested for this order' });
    }

    // Check return window
    const settings = await PlatformSettings.getSettings();
    const windowDays = settings.returnWindowDays || 7;
    const deliveredAt = order.deliveredAt || order.updatedAt;
    const daysSinceDelivery = (Date.now() - new Date(deliveredAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDelivery > windowDays) {
      return res.status(400).json({ message: `Return window of ${windowDays} days has expired` });
    }

    // Build items list (default to all items if not specified)
    const returnItems = items && items.length > 0
      ? items.map(item => ({
        productId: item.productId,
        title: item.title || '',
        quantity: item.quantity || 1,
        price: item.price || 0,
        image: item.image || ''
      }))
      : order.items.map(item => ({
        productId: item.productId,
        title: item.title || '',
        quantity: item.quantity || 1,
        price: item.price || 0,
        image: item.image || ''
      }));

    const refundAmount = returnItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const returnRequest = new ReturnRequest({
      orderId: order._id,
      customerId: req.user._id,
      sellerId: order.sellerId,
      items: returnItems,
      type,
      reason,
      reasonDetails: reasonDetails || '',
      images: images || [],
      refundAmount,
      statusHistory: [{
        status: 'requested',
        timestamp: new Date(),
        changedBy: req.user._id,
        changedByRole: 'customer',
        note: reasonDetails || reason
      }]
    });
    await returnRequest.save();

    // Update order
    order.returnRequestId = returnRequest._id;
    order.returnStatus = 'requested';
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({
      status: 'return_requested',
      timestamp: new Date(),
      changedBy: req.user._id,
      changedByRole: 'customer',
      note: `${type} requested: ${reason}`
    });
    await order.save();

    // Notify seller
    createNotification({
      userId: order.sellerId.toString(),
      userRole: 'seller',
      type: 'return_requested',
      title: `Return request for order #${order.orderNumber}`,
      message: `Customer requested a ${type}: ${reason}`,
      link: '/seller/returns',
      metadata: { orderId: order._id.toString(), returnRequestId: returnRequest._id.toString() }
    });

    logActivity({
      domain: 'order', action: 'return_requested',
      actorRole: 'customer', actorId: req.user._id, actorEmail: req.user.email,
      targetType: 'ReturnRequest', targetId: returnRequest._id,
      message: `Return requested for order ${order.orderNumber}`,
      metadata: { orderId: order._id, type, reason }
    });

    res.status(201).json({ returnRequest });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/returns/my-requests -- customer's return requests
router.get('/my-requests', async (req, res) => {
  try {
    const requests = await ReturnRequest.find({ customerId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('orderId', 'orderNumber totalAmount')
      .lean();
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/returns/:id -- return request detail
router.get('/:id', async (req, res) => {
  try {
    const returnRequest = await ReturnRequest.findById(req.params.id)
      .populate('orderId', 'orderNumber totalAmount items shippingAddress')
      .populate('customerId', 'name email phone')
      .populate('sellerId', 'name email sellerProfile.businessName');
    if (!returnRequest) return res.status(404).json({ message: 'Return request not found' });

    // Verify access (customer, seller, or admin)
    const userId = req.user._id.toString();
    const isCustomer = returnRequest.customerId?._id?.toString() === userId;
    const isSeller = returnRequest.sellerId?._id?.toString() === userId;
    const isAdmin = req.user.role === 'admin';
    if (!isCustomer && !isSeller && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ returnRequest });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
