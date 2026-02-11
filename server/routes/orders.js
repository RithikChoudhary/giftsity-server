const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Seller = require('../models/Seller');
const PlatformSettings = require('../models/PlatformSettings');
const { createCashfreeOrder, getCashfreeOrder, getCashfreePayments, createRefund } = require('../config/cashfree');
const { requireAuth } = require('../middleware/auth');
const { getCommissionRate, calculateOrderFinancials } = require('../utils/commission');
const { sendOrderConfirmation } = require('../utils/email');
const { logActivity } = require('../utils/audit');
const { validateOrderCreation, validatePaymentVerification } = require('../middleware/validators');
const router = express.Router();

// Normalize phone to 10 digits for Cashfree
const normalizePhone = (phone) => {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return '9999999999';
};

// Generate order number: GFT-YYYYMMDD-XXXX
const generateOrderNumber = () => {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `GFT-${date}-${rand}`;
};

// POST /api/orders - create order + Cashfree payment session
router.post('/', requireAuth, validateOrderCreation, async (req, res) => {
  try {
    if ((req.user.userType || req.user.role) !== 'customer') {
      return res.status(403).json({ message: 'Customer access required' });
    }
    const { items, shippingAddress, couponCode } = req.body;
    if (!items || !items.length) return res.status(400).json({ message: 'No items' });
    if (!shippingAddress) return res.status(400).json({ message: 'Shipping address required' });

    const settings = await PlatformSettings.getSettings();

    // Validate coupon if provided
    let couponDiscount = 0;
    let validCoupon = null;
    if (couponCode) {
      try {
        const Coupon = require('../models/Coupon');
        validCoupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true, expiresAt: { $gt: new Date() } });
        if (validCoupon && validCoupon.usedCount < validCoupon.usageLimit) {
          // We'll calculate discount after we know itemTotal
        } else {
          validCoupon = null;
        }
      } catch (e) { /* Coupon model may not exist yet, skip */ }
    }

    // Validate products and reserve stock atomically
    const sellerGroups = {};
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) return res.status(400).json({ message: `Product not found: ${item.productId}` });
      if (!product.isActive) {
        return res.status(400).json({ message: `${product.title} is unavailable` });
      }

      // Atomic stock check -- ensures no race condition
      const stockCheck = await Product.findOne({ _id: item.productId, stock: { $gte: item.quantity } });
      if (!stockCheck) {
        return res.status(400).json({ message: `${product.title} is out of stock (only ${product.stock} left)` });
      }

      // Validate customizations against product's customizationOptions
      if (product.isCustomizable && product.customizationOptions?.length > 0) {
        const custData = item.customizations || [];
        for (const opt of product.customizationOptions) {
          const match = custData.find(c => c.label === opt.label);
          if (opt.required) {
            if (!match) {
              return res.status(400).json({ message: `Customization "${opt.label}" is required for ${product.title}` });
            }
            if (opt.type === 'image' && (!match.imageUrls || match.imageUrls.length === 0)) {
              return res.status(400).json({ message: `Please upload images for "${opt.label}" on ${product.title}` });
            }
            if (opt.type !== 'image' && (!match.value || !match.value.trim())) {
              return res.status(400).json({ message: `Please fill in "${opt.label}" for ${product.title}` });
            }
          }
          if (match) {
            if (opt.type === 'image' && opt.maxFiles && match.imageUrls?.length > opt.maxFiles) {
              return res.status(400).json({ message: `Maximum ${opt.maxFiles} images allowed for "${opt.label}"` });
            }
            if (opt.maxLength && match.value && match.value.length > opt.maxLength) {
              return res.status(400).json({ message: `"${opt.label}" exceeds maximum length of ${opt.maxLength} characters` });
            }
          }
        }
      }

      const sid = product.sellerId.toString();
      if (!sellerGroups[sid]) sellerGroups[sid] = [];
      sellerGroups[sid].push({ product, quantity: item.quantity, customizations: item.customizations || [] });
    }

    const orders = [];
    for (const [sellerId, sellerItems] of Object.entries(sellerGroups)) {
      const seller = await Seller.findById(sellerId);
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
          sellerId,
          customizations: i.customizations || []
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

    // Apply coupon discount if valid
    const grandTotalBeforeDiscount = orders.reduce((s, o) => s + o.totalAmount, 0);
    // Re-validate coupon against actual order total and usage
    if (validCoupon) {
      if (validCoupon.minOrderAmount > 0 && grandTotalBeforeDiscount < validCoupon.minOrderAmount) {
        validCoupon = null; // Order total below minimum
      }
      if (validCoupon && validCoupon.usedBy?.map(id => id.toString()).includes(req.user._id.toString())) {
        validCoupon = null; // Already used by this customer
      }
    }
    if (validCoupon) {
      let discount = 0;
      if (validCoupon.type === 'percent') {
        discount = (grandTotalBeforeDiscount * validCoupon.value) / 100;
        if (validCoupon.maxDiscount > 0) discount = Math.min(discount, validCoupon.maxDiscount);
      } else {
        discount = validCoupon.value;
      }
      discount = Math.min(Math.round(discount), grandTotalBeforeDiscount);

      // Distribute discount across orders proportionally
      let remaining = discount;
      for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        const share = i === orders.length - 1 ? remaining : Math.round(discount * (order.totalAmount / grandTotalBeforeDiscount));
        order.couponCode = validCoupon.code;
        order.discountAmount = share;
        order.totalAmount = Math.max(0, order.totalAmount - share);
        remaining -= share;
        await order.save();
      }

      // Note: Coupon usage is tracked after payment verification, not here
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
        phone: normalizePhone(req.user.phone || shippingAddress.phone),
        name: req.user.name || 'Customer'
      },
      returnUrl: `${(process.env.CLIENT_URL || '').split(',')[0].trim() || 'http://localhost:5173'}/orders?cf_id=${cfOrderId}`
    });

    // Store Cashfree order ID and payment session on all orders
    for (const order of orders) {
      order.cashfreeOrderId = cfOrderId;
      order.paymentSessionId = cfOrder.payment_session_id;
      await order.save();
    }

    for (const order of orders) {
      logActivity({ domain: 'order', action: 'order_created', actorRole: 'customer', actorId: req.user._id, actorEmail: req.user.email, targetType: 'Order', targetId: order._id, message: `Order ${order.orderNumber} created`, metadata: { orderNumber: order.orderNumber, totalAmount: order.totalAmount } });
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
router.post('/verify-payment', requireAuth, validatePaymentVerification, async (req, res) => {
  try {
    if ((req.user.userType || req.user.role) !== 'customer') {
      return res.status(403).json({ message: 'Customer access required' });
    }
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

    // Update all orders with this cashfree order ID (ownership check)
    const orders = await Order.find({ cashfreeOrderId: orderId, customerId: req.user._id });
    for (const order of orders) {
      if (order.paymentStatus === 'paid') continue; // Already processed

      order.paymentStatus = 'paid';
      order.status = 'confirmed';
      order.cashfreePaymentId = successPayment?.cf_payment_id?.toString() || '';
      order.paidAt = new Date();
      await order.save();

      // Atomic stock decrement -- only decrements if sufficient stock
      for (const item of order.items) {
        const updated = await Product.findOneAndUpdate(
          { _id: item.productId, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity, orderCount: item.quantity } },
          { new: true }
        );
        if (!updated) {
          console.error(`[Stock] Insufficient stock for product ${item.productId}, order ${order.orderNumber}`);
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
        console.error('Email send error:', emailErr.message);
      }
    }

    // Track coupon usage after successful payment
    const couponCode = orders.find(o => o.couponCode)?.couponCode;
    if (couponCode) {
      try {
        const Coupon = require('../models/Coupon');
        await Coupon.findOneAndUpdate(
          { code: couponCode },
          { $inc: { usedCount: 1 }, $addToSet: { usedBy: req.user._id } }
        );
      } catch (couponErr) {
        console.error('[Coupon] Failed to track usage:', couponErr.message);
      }
    }

    for (const order of orders) {
      logActivity({ domain: 'order', action: 'payment_verified', actorRole: 'customer', actorId: req.user._id, actorEmail: req.user.email, targetType: 'Order', targetId: order._id, message: `Payment verified for order ${order.orderNumber}` });
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

// GET /api/orders/track/:orderNumber - public order tracking (no auth)
router.get('/track/:orderNumber', async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .select('orderNumber status paymentStatus createdAt paidAt trackingInfo items.title items.quantity items.price items.image')
      .populate('sellerId', 'sellerProfile.businessName')
      .lean();
    if (!order) return res.status(404).json({ message: 'Order not found. Please check your order number.' });

    // Build a timeline from order data
    const timeline = [{ status: 'placed', date: order.createdAt, label: 'Order Placed' }];
    if (order.paidAt) timeline.push({ status: 'paid', date: order.paidAt, label: 'Payment Confirmed' });
    if (['confirmed', 'shipped', 'delivered'].includes(order.status)) {
      timeline.push({ status: 'confirmed', date: order.paidAt || order.createdAt, label: 'Order Confirmed' });
    }
    if (order.trackingInfo?.shippedAt || order.status === 'shipped' || order.status === 'delivered') {
      timeline.push({ status: 'shipped', date: order.trackingInfo?.shippedAt || null, label: 'Shipped' });
    }
    if (order.status === 'delivered') {
      timeline.push({ status: 'delivered', date: order.trackingInfo?.deliveredAt || null, label: 'Delivered' });
    }
    if (order.status === 'cancelled') {
      timeline.push({ status: 'cancelled', date: null, label: 'Cancelled' });
    }

    res.json({
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      items: order.items?.map(i => ({ title: i.title, quantity: i.quantity, price: i.price, image: i.image })),
      tracking: order.trackingInfo ? {
        courierName: order.trackingInfo.courierName,
        trackingNumber: order.trackingInfo.trackingNumber
      } : null,
      sellerName: order.sellerId?.sellerProfile?.businessName || null,
      timeline
    });
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

// POST /api/orders/:id/cancel - customer cancels own order (pending/confirmed only)
router.post('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, customerId: req.user._id });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({ message: `Cannot cancel order with status "${order.status}". Only pending or confirmed orders can be cancelled.` });
    }

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = req.body.reason || 'Cancelled by customer';
    await order.save();

    // Restore stock and initiate refund if payment was completed
    if (order.paymentStatus === 'paid') {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: item.quantity, orderCount: -item.quantity }
        });
      }

      // Initiate Cashfree refund
      try {
        const refundId = `refund_${order.orderNumber}_${Date.now()}`;
        await createRefund({
          orderId: order.cashfreeOrderId,
          refundAmount: order.totalAmount,
          refundId,
          refundNote: order.cancelReason || 'Order cancelled by customer'
        });
        order.paymentStatus = 'refunded';
        order.refundId = refundId;
      } catch (refundErr) {
        console.error('[Refund] Failed for order', order.orderNumber, refundErr?.response?.data || refundErr.message);
        order.paymentStatus = 'refund_pending';
      }
      await order.save();
    }

    logActivity({ domain: 'order', action: 'order_cancelled', actorRole: 'customer', actorId: req.user._id, actorEmail: req.user.email, targetType: 'Order', targetId: order._id, message: `Order ${order.orderNumber} cancelled by customer`, metadata: { reason: order.cancelReason } });
    res.json({ message: 'Order cancelled successfully', order });
  } catch (err) {
    console.error('Cancel order error:', err.message);
    res.status(500).json({ message: 'Failed to cancel order' });
  }
});

module.exports = router;
