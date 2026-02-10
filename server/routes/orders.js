const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const PlatformSettings = require('../models/PlatformSettings');
const { createCashfreeOrder, getCashfreeOrder, getCashfreePayments } = require('../config/cashfree');
const { requireAuth } = require('../middleware/auth');
const { getCommissionRate, calculateOrderFinancials } = require('../utils/commission');
const { sendOrderConfirmation } = require('../utils/email');
const router = express.Router();

// Generate order number: GFT-YYYYMMDD-XXXX
const generateOrderNumber = () => {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `GFT-${date}-${rand}`;
};

// POST /api/orders - create order + Cashfree payment session
router.post('/', requireAuth, async (req, res) => {
  try {
    const { items, shippingAddress } = req.body;
    if (!items || !items.length) return res.status(400).json({ message: 'No items' });
    if (!shippingAddress) return res.status(400).json({ message: 'Shipping address required' });

    const settings = await PlatformSettings.getSettings();

    // Group items by seller
    const sellerGroups = {};
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) return res.status(400).json({ message: `Product not found: ${item.productId}` });
      if (!product.isActive || product.stock < item.quantity) {
        return res.status(400).json({ message: `${product.title} is out of stock or unavailable` });
      }
      const sid = product.sellerId.toString();
      if (!sellerGroups[sid]) sellerGroups[sid] = [];
      sellerGroups[sid].push({ product, quantity: item.quantity });
    }

    const orders = [];
    for (const [sellerId, sellerItems] of Object.entries(sellerGroups)) {
      const seller = await User.findById(sellerId);
      const commissionRate = getCommissionRate(seller, settings);
      const itemTotal = sellerItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
      const shippingCost = 0;
      const totalAmount = itemTotal + shippingCost;
      const financials = calculateOrderFinancials(totalAmount, commissionRate, settings.paymentGatewayFeeRate);

      const order = new Order({
        orderNumber: generateOrderNumber(),
        orderType: 'b2c_marketplace',
        customerId: req.user._id,
        customerEmail: req.user.email,
        customerPhone: req.user.phone || shippingAddress.phone,
        sellerId,
        items: sellerItems.map(i => ({
          productId: i.product._id,
          title: i.product.title,
          price: i.product.price,
          image: i.product.images[0]?.url || '',
          sku: i.product.sku || '',
          quantity: i.quantity,
          sellerId
        })),
        shippingAddress,
        itemTotal,
        shippingCost,
        totalAmount,
        ...financials
      });
      await order.save();
      orders.push(order);
    }

    // Create Cashfree order for the total
    const grandTotal = orders.reduce((s, o) => s + o.totalAmount, 0);
    const cfOrderId = orders[0].orderNumber; // Use our order number as Cashfree order_id

    const cfOrder = await createCashfreeOrder({
      orderId: cfOrderId,
      orderAmount: grandTotal,
      customerDetails: {
        customerId: req.user._id.toString(),
        email: req.user.email,
        phone: req.user.phone || shippingAddress.phone || '9999999999',
        name: req.user.name || 'Customer'
      },
      returnUrl: `${process.env.CLIENT_URL}/orders?cf_id=${cfOrderId}`
    });

    // Store Cashfree order ID and payment session on all orders
    for (const order of orders) {
      order.cashfreeOrderId = cfOrderId;
      order.paymentSessionId = cfOrder.payment_session_id;
      await order.save();
    }

    res.status(201).json({
      orders,
      cashfreeOrder: {
        orderId: cfOrderId,
        paymentSessionId: cfOrder.payment_session_id,
        orderAmount: grandTotal
      },
      appId: process.env.CASHFREE_APP_ID,
      env: process.env.CASHFREE_ENV || 'sandbox'
    });
  } catch (err) {
    console.error('Create order error:', err?.response?.data || err.message || err);
    res.status(500).json({ message: 'Failed to create order', error: err?.response?.data?.message || err.message });
  }
});

// POST /api/orders/verify-payment - verify Cashfree payment
router.post('/verify-payment', requireAuth, async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ message: 'orderId required' });

    // Fetch order status from Cashfree
    const cfOrder = await getCashfreeOrder(orderId);
    if (cfOrder.order_status !== 'PAID') {
      return res.status(400).json({ message: `Payment not completed. Status: ${cfOrder.order_status}` });
    }

    // Get payment details
    const payments = await getCashfreePayments(orderId);
    const successPayment = payments.find(p => p.payment_status === 'SUCCESS');

    // Update all orders with this cashfree order ID
    const orders = await Order.find({ cashfreeOrderId: orderId });
    for (const order of orders) {
      if (order.paymentStatus === 'paid') continue; // Already processed

      order.paymentStatus = 'paid';
      order.status = 'confirmed';
      order.cashfreePaymentId = successPayment?.cf_payment_id?.toString() || '';
      order.paidAt = new Date();
      await order.save();

      // Update product stock and order count
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: -item.quantity, orderCount: item.quantity }
        });
      }

      // Update seller stats
      await User.findByIdAndUpdate(order.sellerId, {
        $inc: { 'sellerProfile.totalSales': order.totalAmount, 'sellerProfile.totalOrders': 1 }
      });

      // Send emails (non-blocking)
      try {
        await sendOrderConfirmation(order.customerEmail, order, 'customer');
        const seller = await User.findById(order.sellerId);
        if (seller) await sendOrderConfirmation(seller.email, order, 'seller');
      } catch (emailErr) {
        console.error('Email send error:', emailErr.message);
      }
    }

    res.json({ message: 'Payment verified', orders });
  } catch (err) {
    console.error('Verify payment error:', err?.response?.data || err.message);
    res.status(500).json({ message: 'Verification failed', error: err.message });
  }
});

// GET /api/orders/my-orders
router.get('/my-orders', requireAuth, async (req, res) => {
  try {
    const orders = await Order.find({ customerId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('sellerId', 'sellerProfile.businessName');
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/orders/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      $or: [{ customerId: req.user._id }, { sellerId: req.user._id }]
    }).populate('sellerId', 'sellerProfile.businessName name').populate('customerId', 'name email phone');

    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json({ order });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
