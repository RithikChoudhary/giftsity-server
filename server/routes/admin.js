const express = require('express');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Category = require('../models/Category');
const SellerPayout = require('../models/SellerPayout');
const B2BInquiry = require('../models/B2BInquiry');
const PlatformSettings = require('../models/PlatformSettings');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { uploadImage, deleteImage } = require('../config/cloudinary');
const { sendCommissionChangeNotification, sendPayoutNotification } = require('../utils/email');
const router = express.Router();

router.use(requireAuth, requireAdmin);

// ---- DASHBOARD ----
router.get('/dashboard', async (req, res) => {
  try {
    const settings = await PlatformSettings.getSettings();
    const totalSellers = await User.countDocuments({ userType: 'seller' });
    const activeSellers = await User.countDocuments({ userType: 'seller', status: 'active' });
    const pendingSellers = await User.countDocuments({ userType: 'seller', status: 'pending' });
    const totalProducts = await Product.countDocuments();
    const totalCustomers = await User.countDocuments({ userType: 'customer' });

    const b2cAgg = await Order.aggregate([
      { $match: { orderType: 'b2c_marketplace', paymentStatus: 'paid' } },
      { $group: { _id: null, gmv: { $sum: '$totalAmount' }, commission: { $sum: '$commissionAmount' }, orders: { $sum: 1 } } }
    ]);
    const b2c = b2cAgg[0] || { gmv: 0, commission: 0, orders: 0 };

    const b2bAgg = await Order.aggregate([
      { $match: { orderType: 'b2b_direct', paymentStatus: 'paid' } },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }
    ]);
    const b2b = b2bAgg[0] || { revenue: 0, orders: 0 };

    const newInquiries = await B2BInquiry.countDocuments({ status: 'new' });
    const totalInquiries = await B2BInquiry.countDocuments();

    const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(10)
      .populate('customerId', 'name email').populate('sellerId', 'sellerProfile.businessName');
    const recentInquiries = await B2BInquiry.find().sort({ createdAt: -1 }).limit(5);

    res.json({
      stats: {
        totalSellers, activeSellers, pendingSellers, totalProducts, totalCustomers,
        b2c: { gmv: b2c.gmv, commissionEarned: b2c.commission, totalOrders: b2c.orders, avgOrderValue: b2c.orders ? Math.round(b2c.gmv / b2c.orders) : 0 },
        b2b: { totalInquiries, newInquiries, totalRevenue: b2b.revenue, totalOrders: b2b.orders }
      },
      currentSettings: { globalCommissionRate: settings.globalCommissionRate, payoutSchedule: settings.payoutSchedule },
      recentOrders,
      recentInquiries
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ---- SETTINGS ----
router.get('/settings', async (req, res) => {
  try {
    const settings = await PlatformSettings.getSettings();
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const settings = await PlatformSettings.getSettings();
    const oldRate = settings.globalCommissionRate;

    Object.assign(settings, req.body, { updatedAt: Date.now(), updatedBy: req.user._id });
    await settings.save();

    // If commission rate changed, notify sellers
    if (req.body.globalCommissionRate !== undefined && req.body.globalCommissionRate !== oldRate) {
      const sellers = await User.find({ userType: 'seller', status: 'active', 'sellerProfile.commissionRate': null });
      for (const seller of sellers) {
        try {
          await sendCommissionChangeNotification(seller.email, seller.name, oldRate, req.body.globalCommissionRate);
        } catch (e) { /* skip email errors */ }
      }
    }

    res.json({ settings, message: 'Settings updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- SELLERS ----
router.get('/sellers', async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const filter = { userType: 'seller' };
    if (status) filter.status = status;
    if (search) filter['sellerProfile.businessName'] = { $regex: search, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sellers = await User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).select('-otp -otpExpiry');
    const total = await User.countDocuments(filter);

    res.json({ sellers, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/sellers/:id', async (req, res) => {
  try {
    const seller = await User.findOne({ _id: req.params.id, userType: 'seller' }).select('-otp -otpExpiry');
    if (!seller) return res.status(404).json({ message: 'Seller not found' });

    const productCount = await Product.countDocuments({ sellerId: seller._id });
    const orderCount = await Order.countDocuments({ sellerId: seller._id, paymentStatus: 'paid' });

    res.json({ seller, productCount, orderCount });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/sellers/:id/approve', async (req, res) => {
  try {
    const seller = await User.findOne({ _id: req.params.id, userType: 'seller' });
    if (!seller) return res.status(404).json({ message: 'Seller not found' });

    const wasSuspended = seller.status === 'suspended';
    seller.status = 'active';
    seller.sellerProfile.approvedAt = new Date();
    seller.sellerProfile.approvedBy = req.user._id;
    seller.sellerProfile.suspensionRemovalRequested = false;
    seller.sellerProfile.suspensionRemovalReason = '';
    await seller.save();

    // Restore products if unsuspending
    if (wasSuspended) {
      await Product.updateMany({ sellerId: seller._id }, { isActive: true });
    }

    res.json({ message: wasSuspended ? 'Seller unsuspended. Products restored.' : 'Seller approved', seller });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/sellers/:id/suspend', async (req, res) => {
  try {
    const { reason } = req.body;
    const seller = await User.findById(req.params.id);
    if (!seller) return res.status(404).json({ message: 'Seller not found' });

    seller.status = 'suspended';
    seller.sellerProfile.suspensionType = 'manual';
    seller.sellerProfile.suspensionReason = reason || 'Suspended by admin';
    seller.sellerProfile.suspensionRemovalRequested = false;
    seller.sellerProfile.suspensionRemovalReason = '';
    await seller.save();

    // Hide all seller products
    await Product.updateMany({ sellerId: seller._id }, { isActive: false });

    res.json({ message: 'Seller suspended. Products hidden.', seller });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/sellers/:id/commission', async (req, res) => {
  try {
    const { commissionRate } = req.body;
    const seller = await User.findOne({ _id: req.params.id, userType: 'seller' });
    if (!seller) return res.status(404).json({ message: 'Seller not found' });

    const oldRate = seller.sellerProfile.commissionRate;
    seller.sellerProfile.commissionRate = commissionRate === null || commissionRate === '' ? null : Number(commissionRate);
    await seller.save();

    if (commissionRate !== oldRate) {
      try {
        const settings = await PlatformSettings.getSettings();
        const effectiveNew = commissionRate ?? settings.globalCommissionRate;
        const effectiveOld = oldRate ?? settings.globalCommissionRate;
        await sendCommissionChangeNotification(seller.email, seller.name, effectiveOld, effectiveNew);
      } catch (e) { /* skip */ }
    }

    res.json({ message: 'Commission updated', seller });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- PRODUCTS ----
router.get('/products', async (req, res) => {
  try {
    const { search, category, seller, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (search) filter.title = { $regex: search, $options: 'i' };
    if (category) filter.category = category;
    if (seller) filter.sellerId = seller;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const products = await Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit))
      .populate('sellerId', 'sellerProfile.businessName name');
    const total = await Product.countDocuments(filter);

    res.json({ products, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/products/:id/feature', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    product.isFeatured = !product.isFeatured;
    await product.save();
    res.json({ product, message: product.isFeatured ? 'Product featured' : 'Product unfeatured' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/products/:id/toggle', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    product.isActive = !product.isActive;
    await product.save();
    res.json({ product, message: product.isActive ? 'Product activated' : 'Product deactivated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- ORDERS ----
router.get('/orders', async (req, res) => {
  try {
    const { status, paymentStatus, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const orders = await Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit))
      .populate('customerId', 'name email phone').populate('sellerId', 'sellerProfile.businessName name');
    const total = await Order.countDocuments(filter);

    res.json({ orders, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/orders/:id', async (req, res) => {
  try {
    const { status, paymentStatus, notes } = req.body;
    const update = { updatedAt: Date.now() };
    if (status) {
      update.status = status;
      if (status === 'delivered') update.deliveredAt = new Date();
      if (status === 'cancelled') update.cancelledAt = new Date();
    }
    if (paymentStatus) update.paymentStatus = paymentStatus;
    if (notes !== undefined) update.notes = notes;

    const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('customerId', 'name email').populate('sellerId', 'sellerProfile.businessName');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json({ order, message: 'Order updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- CATEGORIES ----
router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find().sort({ displayOrder: 1 });
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/categories', async (req, res) => {
  try {
    const { name, description, icon, displayOrder } = req.body;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/g, '');
    const category = new Category({ name, slug, description, icon, displayOrder });

    if (req.body.image && req.body.image.startsWith('data:')) {
      const result = await uploadImage(req.body.image, { folder: 'giftsity/categories' });
      category.image = result;
    }

    await category.save();
    res.status(201).json({ category, message: 'Category created' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/categories/:id', async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, { ...req.body }, { new: true });
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json({ category, message: 'Category updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- PAYOUTS ----
router.get('/payouts', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const payouts = await SellerPayout.find(filter).sort({ createdAt: -1 }).populate('sellerId', 'name email sellerProfile.businessName sellerProfile.bankDetails');
    res.json({ payouts });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/payouts/calculate', async (req, res) => {
  try {
    const { periodStart, periodEnd, periodLabel } = req.body;
    if (!periodStart || !periodEnd) return res.status(400).json({ message: 'Period dates required' });

    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    // Get all delivered, paid orders that haven't been included in a payout yet
    const orders = await Order.find({
      paymentStatus: 'paid',
      status: 'delivered',
      payoutStatus: 'pending',
      deliveredAt: { $gte: start, $lte: end }
    });

    if (!orders.length) return res.json({ message: 'No orders to process', payouts: [] });

    // Group by seller
    const sellerMap = {};
    for (const order of orders) {
      const sid = order.sellerId.toString();
      if (!sellerMap[sid]) sellerMap[sid] = [];
      sellerMap[sid].push(order);
    }

    const payouts = [];
    for (const [sellerId, sellerOrders] of Object.entries(sellerMap)) {
      const seller = await User.findById(sellerId);
      const totalSales = sellerOrders.reduce((s, o) => s + o.totalAmount, 0);
      const commissionDeducted = sellerOrders.reduce((s, o) => s + o.commissionAmount, 0);
      const gatewayFeesDeducted = sellerOrders.reduce((s, o) => s + o.paymentGatewayFee, 0);
      const netPayout = sellerOrders.reduce((s, o) => s + o.sellerAmount, 0);

      const payout = new SellerPayout({
        sellerId,
        periodStart: start,
        periodEnd: end,
        periodLabel: periodLabel || `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
        orderIds: sellerOrders.map(o => o._id),
        orderCount: sellerOrders.length,
        totalSales,
        commissionDeducted,
        gatewayFeesDeducted,
        netPayout,
        bankDetailsSnapshot: seller?.sellerProfile?.bankDetails || {}
      });
      await payout.save();

      // Mark orders as included
      for (const order of sellerOrders) {
        order.payoutStatus = 'included_in_payout';
        order.payoutId = payout._id;
        await order.save();
      }

      payouts.push(payout);
    }

    res.json({ message: `${payouts.length} payouts calculated`, payouts });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/payouts/:id/mark-paid', async (req, res) => {
  try {
    const { transactionId } = req.body;
    const payout = await SellerPayout.findById(req.params.id).populate('sellerId', 'name email');
    if (!payout) return res.status(404).json({ message: 'Payout not found' });

    payout.status = 'paid';
    payout.transactionId = transactionId || '';
    payout.paidAt = new Date();
    payout.paidBy = req.user._id;
    await payout.save();

    // Update order payout statuses
    await Order.updateMany({ payoutId: payout._id }, { payoutStatus: 'paid' });

    // Notify seller
    if (payout.sellerId?.email) {
      try { await sendPayoutNotification(payout.sellerId.email, payout); } catch (e) { /* skip */ }
    }

    res.json({ message: 'Payout marked as paid', payout });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- USERS ----
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({ userType: 'customer' }).sort({ createdAt: -1 }).select('-otp -otpExpiry');
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/customers - customer analytics with shopping stats, sorted by highest spender
router.get('/customers', async (req, res) => {
  try {
    const { search, filter, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Aggregate customers with order stats
    const pipeline = [
      { $match: { userType: 'customer' } },
      {
        $lookup: {
          from: 'orders',
          localField: '_id',
          foreignField: 'customerId',
          as: 'orders'
        }
      },
      {
        $addFields: {
          totalSpent: {
            $sum: {
              $map: {
                input: { $filter: { input: '$orders', cond: { $eq: ['$$this.paymentStatus', 'paid'] } } },
                as: 'o',
                in: '$$o.totalAmount'
              }
            }
          },
          orderCount: {
            $size: { $filter: { input: '$orders', cond: { $eq: ['$$this.paymentStatus', 'paid'] } } }
          },
          lastOrderDate: {
            $max: '$orders.createdAt'
          }
        }
      },
      { $project: { otp: 0, otpExpiry: 0, orders: 0, sellerProfile: 0 } }
    ];

    // Search filter
    if (search) {
      pipeline.splice(1, 0, {
        $match: {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    // Has orders filter
    if (filter === 'has_orders') {
      pipeline.push({ $match: { orderCount: { $gt: 0 } } });
    } else if (filter === 'no_orders') {
      pipeline.push({ $match: { orderCount: 0 } });
    }

    // Get total before pagination
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await User.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Sort by highest spender, then paginate
    pipeline.push({ $sort: { totalSpent: -1, createdAt: -1 } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });

    const customers = await User.aggregate(pipeline);

    // Summary stats
    const summaryPipeline = [
      { $match: { userType: 'customer' } },
      {
        $lookup: {
          from: 'orders',
          localField: '_id',
          foreignField: 'customerId',
          pipeline: [{ $match: { paymentStatus: 'paid' } }],
          as: 'paidOrders'
        }
      },
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: 1 },
          customersWithOrders: { $sum: { $cond: [{ $gt: [{ $size: '$paidOrders' }, 0] }, 1, 0] } },
          totalRevenue: { $sum: { $sum: '$paidOrders.totalAmount' } },
          totalOrders: { $sum: { $size: '$paidOrders' } }
        }
      }
    ];
    const summaryResult = await User.aggregate(summaryPipeline);
    const summary = summaryResult[0] || { totalCustomers: 0, customersWithOrders: 0, totalRevenue: 0, totalOrders: 0 };
    summary.customersWithNoOrders = summary.totalCustomers - summary.customersWithOrders;
    summary.avgOrderValue = summary.totalOrders > 0 ? Math.round(summary.totalRevenue / summary.totalOrders) : 0;

    res.json({
      customers,
      summary,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error('Customer analytics error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- SELLER HEALTH METRICS ----
router.get('/sellers/:id/health', async (req, res) => {
  try {
    const seller = await User.findOne({ _id: req.params.id, userType: 'seller' }).select('sellerProfile.metrics sellerProfile.businessName sellerProfile.suspensionType sellerProfile.suspensionReason status');
    if (!seller) return res.status(404).json({ message: 'Seller not found' });

    // Get order breakdown for last 30 days
    const lookback = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const orders = await Order.find({ sellerId: seller._id, createdAt: { $gte: lookback } });

    const breakdown = {
      total: orders.length,
      delivered: orders.filter(o => o.status === 'delivered').length,
      shipped: orders.filter(o => o.status === 'shipped').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length,
      pending: orders.filter(o => ['pending', 'confirmed', 'processing'].includes(o.status)).length,
    };

    res.json({
      seller: {
        _id: seller._id,
        businessName: seller.sellerProfile?.businessName,
        status: seller.status,
        suspensionType: seller.sellerProfile?.suspensionType,
        suspensionReason: seller.sellerProfile?.suspensionReason
      },
      metrics: seller.sellerProfile?.metrics || {},
      orderBreakdown: breakdown
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- MANUAL CRON TRIGGER ----
router.post('/cron/run', async (req, res) => {
  try {
    const { runAllCrons } = require('../cron/sellerHealth');
    await runAllCrons();
    res.json({ message: 'Seller health cron jobs executed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Cron execution failed', error: err.message });
  }
});

module.exports = router;
