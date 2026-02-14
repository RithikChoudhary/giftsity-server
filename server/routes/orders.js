const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Seller = require('../models/Seller');
const Shipment = require('../models/Shipment');
const PlatformSettings = require('../models/PlatformSettings');
const { createCashfreeOrder, getCashfreeOrder, getCashfreePayments, createRefund } = require('../config/cashfree');
const shiprocket = require('../config/shiprocket');
const { requireAuth } = require('../middleware/auth');
const { getCommissionRate, calculateOrderFinancials } = require('../utils/commission');
const { sendOrderConfirmation } = require('../utils/email');
const { logActivity } = require('../utils/audit');
const { sanitizeBody } = require('../middleware/sanitize');
const { validateOrderCreation, validatePaymentVerification } = require('../middleware/validators');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const router = express.Router();

// Rate limiter: max 10 order creations per user per minute
const orderCreationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?._id?.toString() || 'unknown',
  message: { message: 'Too many order attempts. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false
});

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
router.post('/', requireAuth, orderCreationLimiter, validateOrderCreation, async (req, res) => {
  try {
    if ((req.user.userType || req.user.role) !== 'customer') {
      return res.status(403).json({ message: 'Customer access required' });
    }
    const { items, shippingAddress, shippingEstimates, couponCode } = req.body;
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

    // Validate products and build seller groups
    const sellerGroups = {};
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) return res.status(400).json({ message: `Product not found: ${item.productId}` });
      if (!product.isActive) {
        return res.status(400).json({ message: `${product.title} is unavailable` });
      }

      // Check stock availability (actual reservation happens below)
      if (product.stock < item.quantity) {
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

    // Reserve stock atomically for all items BEFORE creating orders
    // Track reserved items so we can rollback on failure
    const reservedItems = []; // { productId, quantity }
    try {
      for (const item of items) {
        const updated = await Product.findOneAndUpdate(
          { _id: item.productId, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { new: true }
        );
        if (!updated) {
          // Rollback all previously reserved items
          for (const ri of reservedItems) {
            await Product.findByIdAndUpdate(ri.productId, { $inc: { stock: ri.quantity } });
          }
          const prod = await Product.findById(item.productId);
          return res.status(400).json({ message: `${prod?.title || 'Product'} is out of stock` });
        }
        reservedItems.push({ productId: item.productId, quantity: item.quantity });
      }
    } catch (stockErr) {
      // Rollback on any error
      for (const ri of reservedItems) {
        await Product.findByIdAndUpdate(ri.productId, { $inc: { stock: ri.quantity } });
      }
      throw stockErr;
    }

    const orders = [];
    try {
      for (const [sellerId, sellerItems] of Object.entries(sellerGroups)) {
        const seller = await Seller.findById(sellerId);
        const commissionRate = getCommissionRate(seller, settings);
        const itemTotal = sellerItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

        // Get shipping info from estimates (passed from frontend)
        const sellerShipping = shippingEstimates?.[sellerId] || {};
        const shippingCost = sellerShipping.shippingCost || 0;
        const shippingPaidBy = sellerShipping.shippingPaidBy || 'seller';

        // Customer-facing total: includes shipping only if customer pays
        const totalAmount = shippingPaidBy === 'customer' ? itemTotal + shippingCost : itemTotal;

        // Commission/gateway fees apply to itemTotal only (shipping is pass-through)
        const financials = calculateOrderFinancials(itemTotal, commissionRate, settings.paymentGatewayFeeRate);

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
          shippingPaidBy,
          totalAmount,
          ...financials
        });
        await order.save();
        orders.push(order);
      }
    } catch (orderErr) {
      // If order creation fails, rollback reserved stock
      for (const ri of reservedItems) {
        await Product.findByIdAndUpdate(ri.productId, { $inc: { stock: ri.quantity } });
      }
      throw orderErr;
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
    logger.error('Create order error:', err?.response?.data || err.message || err);
    res.status(500).json({ message: 'Failed to create order', error: err?.response?.data?.message || err.message });
  }
});

// POST /api/orders/cancel-pending - cancel user's unpaid pending orders and restore stock
// Called from Cart.jsx before creating a new order (cleans up abandoned checkouts)
router.post('/cancel-pending', requireAuth, async (req, res) => {
  try {
    if ((req.user.userType || req.user.role) !== 'customer') {
      return res.status(403).json({ message: 'Customer access required' });
    }

    const pendingOrders = await Order.find({
      customerId: req.user._id,
      status: 'pending',
      paymentStatus: 'pending'
    });

    let cancelled = 0;
    for (const order of pendingOrders) {
      // Restore reserved stock for each item
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: item.quantity }
        });
      }

      order.status = 'cancelled';
      order.cancelledAt = new Date();
      order.cancelReason = 'Replaced by new checkout';
      await order.save();
      cancelled++;

      logger.info(`[CancelPending] Cancelled order ${order.orderNumber} for user ${req.user._id}`);
    }

    res.json({ cancelled });
  } catch (err) {
    logger.error('Cancel pending error:', err.message);
    res.status(500).json({ message: 'Failed to cancel pending orders' });
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

    // Verify payment amount matches order total (prevent amount tampering)
    const expectedTotal = orders.reduce((s, o) => s + o.totalAmount, 0);
    const paidAmount = parseFloat(cfOrder.order_amount);
    if (Math.abs(paidAmount - expectedTotal) > 1) {
      logger.error(`[Payment] AMOUNT MISMATCH on verify: paid ${paidAmount}, expected ${expectedTotal}, orderId=${orderId}`);
      logActivity({ domain: 'payment', action: 'payment_amount_mismatch', actorRole: 'customer', actorId: req.user._id, actorEmail: req.user.email, targetType: 'Order', targetId: orders[0]?._id, message: `Amount mismatch: paid ${paidAmount}, expected ${expectedTotal}` });
      return res.status(400).json({ message: 'Payment amount does not match order total. Please contact support.' });
    }
    for (const order of orders) {
      if (order.paymentStatus === 'paid') continue; // Already processed

      order.paymentStatus = 'paid';
      order.status = 'confirmed';
      order.cashfreePaymentId = successPayment?.cf_payment_id?.toString() || '';
      order.paidAt = new Date();
      await order.save();

      // Stock was already reserved at order creation time.
      // Just increment orderCount now that payment is confirmed.
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
        logger.error('Email send error:', emailErr.message);
      }
    }

    // Track coupon usage after successful payment (with race-condition-safe predicate)
    const couponCode = orders.find(o => o.couponCode)?.couponCode;
    if (couponCode) {
      try {
        const Coupon = require('../models/Coupon');
        const couponDoc = await Coupon.findOne({ code: couponCode });
        if (couponDoc) {
          const result = await Coupon.findOneAndUpdate(
            { code: couponCode, usedCount: { $lt: couponDoc.usageLimit } },
            { $inc: { usedCount: 1 }, $addToSet: { usedBy: req.user._id } }
          );
          if (!result) logger.warn('[Coupon] Usage limit exceeded for', couponCode);
        }
      } catch (couponErr) {
        logger.error('[Coupon] Failed to track usage:', couponErr.message);
      }
    }

    for (const order of orders) {
      logActivity({ domain: 'order', action: 'payment_verified', actorRole: 'customer', actorId: req.user._id, actorEmail: req.user.email, targetType: 'Order', targetId: order._id, message: `Payment verified for order ${order.orderNumber}` });
    }

    res.json({ message: 'Payment verified', orders });
  } catch (err) {
    logger.error('Verify payment error:', err?.response?.data || err.message);
    res.status(500).json({ message: 'Verification failed', error: err.message });
  }
});

// GET /api/orders/my-orders
router.get('/my-orders', requireAuth, async (req, res) => {
  try {
    // Exclude unpaid pending orders (abandoned checkouts) — customers should not see these
    const orders = await Order.find({
      customerId: req.user._id,
      $or: [
        { paymentStatus: { $ne: 'pending' } },       // Show paid, refunded orders
        { status: { $in: ['cancelled', 'refunded'] } } // Show cancelled orders even if payment was pending
      ]
    })
      .sort({ createdAt: -1 })
      .populate('sellerId', 'sellerProfile.businessName');
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Rate limiter for public tracking endpoints (prevent enumeration)
const trackingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { message: 'Too many tracking requests. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false
});

// GET /api/orders/track/:orderNumber - public order tracking (no auth)
router.get('/track/:orderNumber', trackingLimiter, async (req, res) => {
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

// GET /api/orders/track/:orderNumber/details - public detailed tracking with scan events
router.get('/track/:orderNumber/details', trackingLimiter, async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .select('_id orderNumber status trackingInfo')
      .lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const shipment = await Shipment.findOne({ orderId: order._id }).lean();
    if (!shipment) {
      return res.json({
        orderNumber: order.orderNumber,
        status: order.status,
        shipmentStatus: null,
        courierName: order.trackingInfo?.courierName || null,
        awb: order.trackingInfo?.trackingNumber || null,
        estimatedDelivery: null,
        scans: []
      });
    }

    // Try to get real-time tracking from Shiprocket if AWB exists
    let liveScans = [];
    if (shipment.awbCode) {
      try {
        const trackData = await shiprocket.trackByAwb(shipment.awbCode);
        const activities = trackData?.tracking_data?.shipment_track_activities
          || trackData?.tracking_data?.track_activities || [];
        liveScans = activities.map(a => ({
          activity: a.activity || a['sr-status-label'] || '',
          location: a.location || '',
          timestamp: a.date || null,
          status: a['sr-status-label'] || a.status || ''
        }));
      } catch (trackErr) {
        logger.warn('[Tracking] Live tracking failed for AWB', shipment.awbCode, trackErr.message);
      }
    }

    // Merge DB history with live scans (prefer live if available, otherwise use DB)
    const dbScans = (shipment.statusHistory || []).map(h => ({
      activity: h.description || h.status || '',
      location: h.location || '',
      timestamp: h.timestamp || null,
      status: h.status || ''
    }));

    const scans = liveScans.length > 0 ? liveScans : dbScans;

    res.json({
      orderNumber: order.orderNumber,
      status: order.status,
      shipmentStatus: shipment.status,
      courierName: shipment.courierName || order.trackingInfo?.courierName || null,
      awb: shipment.awbCode || order.trackingInfo?.trackingNumber || null,
      estimatedDelivery: shipment.estimatedDelivery || order.trackingInfo?.estimatedDelivery || null,
      scans
    });
  } catch (err) {
    logger.error('[Tracking] Public tracking error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/orders/:id/tracking - authenticated customer tracking with scan events
router.get('/:id/tracking', requireAuth, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      $or: [{ customerId: req.user._id }, { sellerId: req.user._id }]
    }).select('_id orderNumber status trackingInfo').lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const shipment = await Shipment.findOne({ orderId: order._id }).lean();
    if (!shipment) {
      return res.json({
        orderNumber: order.orderNumber,
        status: order.status,
        shipmentStatus: null,
        courierName: order.trackingInfo?.courierName || null,
        awb: order.trackingInfo?.trackingNumber || null,
        estimatedDelivery: null,
        scans: []
      });
    }

    // Try real-time Shiprocket tracking
    let liveScans = [];
    if (shipment.awbCode) {
      try {
        const trackData = await shiprocket.trackByAwb(shipment.awbCode);
        const activities = trackData?.tracking_data?.shipment_track_activities
          || trackData?.tracking_data?.track_activities || [];
        liveScans = activities.map(a => ({
          activity: a.activity || a['sr-status-label'] || '',
          location: a.location || '',
          timestamp: a.date || null,
          status: a['sr-status-label'] || a.status || ''
        }));
      } catch (trackErr) {
        logger.warn('[Tracking] Live tracking failed for AWB', shipment.awbCode, trackErr.message);
      }
    }

    const dbScans = (shipment.statusHistory || []).map(h => ({
      activity: h.description || h.status || '',
      location: h.location || '',
      timestamp: h.timestamp || null,
      status: h.status || ''
    }));

    const scans = liveScans.length > 0 ? liveScans : dbScans;

    res.json({
      orderNumber: order.orderNumber,
      status: order.status,
      shipmentStatus: shipment.status,
      courierName: shipment.courierName || order.trackingInfo?.courierName || null,
      awb: shipment.awbCode || order.trackingInfo?.trackingNumber || null,
      estimatedDelivery: shipment.estimatedDelivery || order.trackingInfo?.estimatedDelivery || null,
      scans
    });
  } catch (err) {
    logger.error('[Tracking] Authenticated tracking error:', err.message);
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

// GET /api/orders/:id/invoice - download PDF invoice for paid orders
router.get('/:id/invoice', requireAuth, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, customerId: req.user._id }).lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({ message: 'Invoice is only available for paid orders' });
    }

    const Customer = require('../models/Customer');
    const customer = await Customer.findById(req.user._id).lean();
    const { generateOrderInvoice } = require('../utils/pdf');
    const pdfBuffer = await generateOrderInvoice(order, customer);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${order.orderNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    logger.error('Invoice generation error:', err.message);
    res.status(500).json({ message: 'Failed to generate invoice' });
  }
});

// POST /api/orders/:id/cancel - customer cancels own order (pending/confirmed only)
router.post('/:id/cancel', requireAuth, sanitizeBody, async (req, res) => {
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

    // Restore reserved stock (stock is reserved at order creation)
    for (const item of order.items) {
      const stockInc = { stock: item.quantity };
      if (order.paymentStatus === 'paid') stockInc.orderCount = -item.quantity;
      await Product.findByIdAndUpdate(item.productId, { $inc: stockInc });
    }

    // Initiate refund if payment was completed
    if (order.paymentStatus === 'paid') {

      // Initiate Cashfree refund (verify actual paid amount to prevent over-refund)
      try {
        let refundAmount = order.totalAmount;
        try {
          const cfOrderData = await getCashfreeOrder(order.cashfreeOrderId);
          if (cfOrderData.order_amount) {
            refundAmount = Math.min(order.totalAmount, parseFloat(cfOrderData.order_amount));
          }
        } catch (cfErr) {
          logger.warn('[Refund] Could not verify Cashfree amount, using order total:', cfErr.message);
        }
        const refundId = `refund_${order.orderNumber}_${Date.now()}`;
        await createRefund({
          orderId: order.cashfreeOrderId,
          refundAmount,
          refundId,
          refundNote: order.cancelReason || 'Order cancelled by customer'
        });
        order.paymentStatus = 'refunded';
        order.refundId = refundId;
      } catch (refundErr) {
        logger.error('[Refund] Failed for order', order.orderNumber, refundErr?.response?.data || refundErr.message);
        order.paymentStatus = 'refund_pending';
      }
      await order.save();
    }

    logActivity({ domain: 'order', action: 'order_cancelled', actorRole: 'customer', actorId: req.user._id, actorEmail: req.user.email, targetType: 'Order', targetId: order._id, message: `Order ${order.orderNumber} cancelled by customer`, metadata: { reason: order.cancelReason } });
    res.json({ message: 'Order cancelled successfully', order });
  } catch (err) {
    logger.error('Cancel order error:', err.message);
    res.status(500).json({ message: 'Failed to cancel order' });
  }
});

// POST /api/orders/shipping-estimate - get shipping rates for cart items
router.post('/shipping-estimate', requireAuth, async (req, res) => {
  try {
    const { items, deliveryPincode } = req.body;
    if (!items?.length || !deliveryPincode) {
      return res.status(400).json({ message: 'Items and delivery pincode required' });
    }

    // Load products with seller info
    const productIds = items.map(i => i.productId);
    const products = await Product.find({ _id: { $in: productIds } }).lean();

    // Group products by seller
    const sellerGroups = {};
    for (const item of items) {
      const product = products.find(p => p._id.toString() === item.productId);
      if (!product) continue;
      const sid = product.sellerId.toString();
      if (!sellerGroups[sid]) sellerGroups[sid] = { products: [], totalWeight: 0 };
      sellerGroups[sid].products.push(product);
      sellerGroups[sid].totalWeight += (product.weight || 500) * (item.quantity || 1);
      // Use first product's shippingPaidBy (all items from same seller in one shipment)
      if (!sellerGroups[sid].shippingPaidBy) sellerGroups[sid].shippingPaidBy = product.shippingPaidBy || 'seller';
    }

    const estimates = [];
    for (const [sellerId, group] of Object.entries(sellerGroups)) {
      const seller = await Seller.findById(sellerId).lean();
      const pickupPincode = seller?.sellerProfile?.pickupAddress?.pincode;

      if (!pickupPincode) {
        estimates.push({
          sellerId,
          shippingCost: 0,
          shippingPaidBy: group.shippingPaidBy,
          courierName: '',
          estimatedDays: '',
          error: 'Seller pickup address not configured'
        });
        continue;
      }

      try {
        const result = await shiprocket.checkServiceability({
          pickupPincode,
          deliveryPincode,
          weight: group.totalWeight,
          cod: 0
        });

        const companies = result?.data?.available_courier_companies || result?.available_courier_companies || [];
        if (companies.length > 0) {
          // Pick cheapest courier
          const cheapest = companies.reduce((min, c) => c.rate < min.rate ? c : min, companies[0]);
          estimates.push({
            sellerId,
            shippingCost: Math.round(cheapest.rate),
            shippingPaidBy: group.shippingPaidBy,
            courierName: cheapest.courier_name,
            estimatedDays: cheapest.estimated_delivery_days,
          });
        } else {
          estimates.push({
            sellerId,
            shippingCost: 0,
            shippingPaidBy: group.shippingPaidBy,
            courierName: '',
            estimatedDays: '',
            error: 'No couriers available for this route'
          });
        }
      } catch (err) {
        logger.error(`Shipping estimate error for seller ${sellerId}:`, err.message);
        estimates.push({
          sellerId,
          shippingCost: 0,
          shippingPaidBy: group.shippingPaidBy,
          courierName: '',
          estimatedDays: '',
          error: 'Could not estimate shipping'
        });
      }
    }

    res.json({ estimates });
  } catch (err) {
    logger.error('Shipping estimate error:', err.message);
    res.status(500).json({ message: 'Failed to estimate shipping' });
  }
});

module.exports = router;
