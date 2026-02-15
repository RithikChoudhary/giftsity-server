const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Seller = require('../models/Seller');
const Admin = require('../models/Admin');
const Category = require('../models/Category');
const SellerPayout = require('../models/SellerPayout');
const B2BInquiry = require('../models/B2BInquiry');
const PlatformSettings = require('../models/PlatformSettings');
const CorporateUser = require('../models/CorporateUser');
const CorporateCatalog = require('../models/CorporateCatalog');
const CorporateQuote = require('../models/CorporateQuote');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { uploadImage, deleteImage } = require('../config/cloudinary');
const { sendCommissionChangeNotification, sendPayoutNotification, sendCorporateWelcomeEmail, sendCorporateQuoteNotification } = require('../utils/email');
const { logActivity } = require('../utils/audit');
const logger = require('../utils/logger');
const { invalidateCache } = require('../middleware/cache');
const router = express.Router();

router.use(requireAuth, requireAdmin);

// Helper to escape user input for safe use in $regex queries (prevents ReDoS)
const escapeRegex = (str) => (typeof str === 'string' ? str : '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---- DASHBOARD ----
router.get('/dashboard', async (req, res) => {
  try {
    const settings = await PlatformSettings.getSettings();
    const totalSellers = await Seller.countDocuments();
    const activeSellers = await Seller.countDocuments({ status: 'active' });
    const pendingSellers = await Seller.countDocuments({ status: 'pending' });
    const totalProducts = await Product.countDocuments();
    const totalCustomers = await Customer.countDocuments();

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
      const sellers = await Seller.find({ status: 'active', 'sellerProfile.commissionRate': null });
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
    const filter = {};
    if (status && typeof status === 'string') filter.status = status;
    if (search) filter['sellerProfile.businessName'] = { $regex: escapeRegex(search), $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sellers = await Seller.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).select('-otp -otpExpiry');
    const total = await Seller.countDocuments(filter);

    res.json({ sellers, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/sellers/:id', async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id).select('-otp -otpExpiry');
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
    const seller = await Seller.findById(req.params.id);
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

    logActivity({ domain: 'admin', action: wasSuspended ? 'seller_unsuspended' : 'seller_approved', actorRole: 'admin', actorId: req.user._id, actorEmail: req.user.email, targetType: 'Seller', targetId: seller._id, message: wasSuspended ? `Seller ${seller.name} unsuspended` : `Seller ${seller.name} approved` });
    const sellerResponse = seller.toObject();
    delete sellerResponse.otp;
    delete sellerResponse.otpExpiry;
    invalidateCache('/api/products');
    invalidateCache('/api/store/');
    res.json({ message: wasSuspended ? 'Seller unsuspended. Products restored.' : 'Seller approved', seller: sellerResponse });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/sellers/:id/suspend', async (req, res) => {
  try {
    const { reason } = req.body;
    const seller = await Seller.findById(req.params.id);
    if (!seller) return res.status(404).json({ message: 'Seller not found' });

    seller.status = 'suspended';
    seller.sellerProfile.suspensionType = 'manual';
    seller.sellerProfile.suspensionReason = reason || 'Suspended by admin';
    seller.sellerProfile.suspensionRemovalRequested = false;
    seller.sellerProfile.suspensionRemovalReason = '';
    await seller.save();

    // Hide all seller products
    await Product.updateMany({ sellerId: seller._id }, { isActive: false });

    logActivity({ domain: 'admin', action: 'seller_suspended', actorRole: 'admin', actorId: req.user._id, actorEmail: req.user.email, targetType: 'Seller', targetId: seller._id, message: `Seller ${seller.name} suspended: ${reason || 'No reason'}` });
    const sellerResponse = seller.toObject();
    delete sellerResponse.otp;
    delete sellerResponse.otpExpiry;
    invalidateCache('/api/products');
    invalidateCache('/api/store/');
    res.json({ message: 'Seller suspended. Products hidden.', seller: sellerResponse });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/sellers/:id/commission', async (req, res) => {
  try {
    const { commissionRate } = req.body;
    const seller = await Seller.findById(req.params.id);
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

    logActivity({ domain: 'admin', action: 'commission_changed', actorRole: 'admin', actorId: req.user._id, actorEmail: req.user.email, targetType: 'Seller', targetId: seller._id, message: `Commission changed from ${oldRate} to ${commissionRate}`, metadata: { oldRate, newRate: commissionRate } });
    const sellerResponse = seller.toObject();
    delete sellerResponse.otp;
    delete sellerResponse.otpExpiry;
    res.json({ message: 'Commission updated', seller: sellerResponse });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- PRODUCTS ----
router.get('/products', async (req, res) => {
  try {
    const { search, category, seller, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (search) filter.title = { $regex: escapeRegex(search), $options: 'i' };
    if (category && typeof category === 'string') filter.category = category;
    if (seller && typeof seller === 'string' && /^[a-f0-9]{24}$/i.test(seller)) filter.sellerId = seller;

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

// Delete product (admin)
router.delete('/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- ORDERS ----
router.get('/orders', async (req, res) => {
  try {
    const { status, paymentStatus, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status && typeof status === 'string') filter.status = status;
    if (paymentStatus && typeof paymentStatus === 'string') filter.paymentStatus = paymentStatus;

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

    // Validate status transition if status is being changed
    if (status) {
      const currentOrder = await Order.findById(req.params.id);
      if (!currentOrder) return res.status(404).json({ message: 'Order not found' });

      const { isValidTransition } = require('../utils/orderStatus');
      if (!isValidTransition(currentOrder.status, status)) {
        return res.status(400).json({ message: `Cannot change order status from "${currentOrder.status}" to "${status}"` });
      }
    }

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
    logActivity({ domain: 'admin', action: 'category_created', actorRole: 'admin', actorId: req.user._id, actorEmail: req.user.email, targetType: 'Category', targetId: category._id, message: `Category "${name}" created` });
    res.status(201).json({ category, message: 'Category created' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/categories/:id', async (req, res) => {
  try {
    // Whitelist allowed fields to prevent mass assignment
    const { name, description, icon, displayOrder, image, isActive } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (icon !== undefined) update.icon = icon;
    if (displayOrder !== undefined) update.displayOrder = displayOrder;
    if (isActive !== undefined) update.isActive = isActive;
    if (image !== undefined) update.image = image;

    const category = await Category.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!category) return res.status(404).json({ message: 'Category not found' });
    invalidateCache('/api/products/categories');
    logActivity({ domain: 'admin', action: 'category_updated', actorRole: 'admin', actorId: req.user._id, actorEmail: req.user.email, targetType: 'Category', targetId: category._id, message: `Category "${category.name}" updated` });
    res.json({ category, message: 'Category updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    logActivity({ domain: 'admin', action: 'category_deleted', actorRole: 'admin', actorId: req.user._id, actorEmail: req.user.email, targetType: 'Category', targetId: req.params.id, message: `Category deleted` });
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
    if (status && typeof status === 'string') filter.status = status;
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
    let duplicatesSkipped = 0;

    for (const [sellerId, sellerOrders] of Object.entries(sellerMap)) {
      const seller = await Seller.findById(sellerId);

      // Duplicate protection: skip if a payout already exists for overlapping period
      const existingPayout = await SellerPayout.findOne({
        sellerId,
        periodStart: { $lte: end },
        periodEnd: { $gte: start }
      });
      if (existingPayout) {
        duplicatesSkipped++;
        continue;
      }

      const totalSales = sellerOrders.reduce((s, o) => s + (o.itemTotal || o.totalAmount), 0);
      const commissionDeducted = sellerOrders.reduce((s, o) => s + (o.commissionAmount || 0), 0);
      const gatewayFeesDeducted = sellerOrders.reduce((s, o) => s + (o.paymentGatewayFee || 0), 0);
      // Shipping deducted: only for orders where seller pays shipping
      const shippingDeducted = sellerOrders.reduce((s, o) => {
        return s + (o.shippingPaidBy === 'seller' ? (o.shippingCost || 0) : 0);
      }, 0);
      const sellerAmountBeforeShipping = sellerOrders.reduce((s, o) => s + (o.sellerAmount || 0), 0);
      const netPayout = Math.max(0, sellerAmountBeforeShipping - shippingDeducted);

      // Check bank details
      const bank = seller?.sellerProfile?.bankDetails;
      const hasBankDetails = bank?.accountHolderName && bank?.accountNumber && bank?.ifscCode && bank?.bankName;

      const payoutData = {
        sellerId,
        periodStart: start,
        periodEnd: end,
        periodLabel: periodLabel || `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
        orderIds: sellerOrders.map(o => o._id),
        orderCount: sellerOrders.length,
        totalSales,
        commissionDeducted,
        gatewayFeesDeducted,
        shippingDeducted,
        netPayout,
        status: hasBankDetails ? 'pending' : 'on_hold',
        holdReason: hasBankDetails ? '' : 'missing_bank_details',
        bankDetailsSnapshot: bank || {}
      };

      // Attempt transactional write; fall back if replica set unavailable
      let savedPayout;
      let session = null;
      try {
        session = await mongoose.startSession();
        await session.withTransaction(async () => {
          savedPayout = new SellerPayout(payoutData);
          await savedPayout.save({ session });
          await Order.updateMany(
            { _id: { $in: sellerOrders.map(o => o._id) } },
            { payoutStatus: 'included_in_payout', payoutId: savedPayout._id },
            { session }
          );
        });
      } catch (txErr) {
        if (txErr.codeName === 'IllegalOperation' || txErr.message?.includes('transaction')) {
          savedPayout = new SellerPayout(payoutData);
          await savedPayout.save();
          await Order.updateMany(
            { _id: { $in: sellerOrders.map(o => o._id) } },
            { payoutStatus: 'included_in_payout', payoutId: savedPayout._id }
          );
        } else {
          throw txErr;
        }
      } finally {
        if (session) session.endSession();
      }

      payouts.push(savedPayout);
    }

    const msg = `${payouts.length} payouts calculated` + (duplicatesSkipped ? `, ${duplicatesSkipped} duplicates skipped` : '');
    res.json({ message: msg, payouts });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/payouts/:id/mark-paid', async (req, res) => {
  try {
    const { transactionId } = req.body;
    const payout = await SellerPayout.findById(req.params.id).populate('sellerId', 'name email');
    if (!payout) return res.status(404).json({ message: 'Payout not found' });

    // Transactional write: payout status + order statuses must be atomic
    let session = null;
    try {
      session = await mongoose.startSession();
      await session.withTransaction(async () => {
        payout.status = 'paid';
        payout.transactionId = transactionId || '';
        payout.paidAt = new Date();
        payout.paidBy = req.user._id;
        await payout.save({ session });
        await Order.updateMany({ payoutId: payout._id }, { payoutStatus: 'paid' }, { session });
      });
    } catch (txErr) {
      if (txErr.codeName === 'IllegalOperation' || txErr.message?.includes('transaction')) {
        payout.status = 'paid';
        payout.transactionId = transactionId || '';
        payout.paidAt = new Date();
        payout.paidBy = req.user._id;
        await payout.save();
        await Order.updateMany({ payoutId: payout._id }, { payoutStatus: 'paid' });
      } else {
        throw txErr;
      }
    } finally {
      if (session) session.endSession();
    }

    // Notify seller
    if (payout.sellerId?.email) {
      try { await sendPayoutNotification(payout.sellerId.email, payout); } catch (e) { /* skip */ }
    }

    logActivity({ domain: 'admin', action: 'payout_paid', actorRole: 'admin', actorId: req.user._id, actorEmail: req.user.email, targetType: 'SellerPayout', targetId: payout._id, message: `Payout ${payout._id} marked paid for seller`, metadata: { amount: payout.netPayout, transactionId } });
    res.json({ message: 'Payout marked as paid', payout });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/payouts/:id/mark-failed', async (req, res) => {
  try {
    const { reason } = req.body;
    const payout = await SellerPayout.findById(req.params.id);
    if (!payout) return res.status(404).json({ message: 'Payout not found' });

    payout.status = 'failed';
    payout.failureDetails = reason || 'Bank transfer failed';
    payout.retryCount = (payout.retryCount || 0) + 1;
    await payout.save();

    logActivity({ domain: 'admin', action: 'payout_failed', actorRole: 'admin', actorId: req.user._id, actorEmail: req.user.email, targetType: 'SellerPayout', targetId: payout._id, message: `Payout marked failed: ${reason}`, metadata: { amount: payout.netPayout } });
    res.json({ message: 'Payout marked as failed', payout });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/payouts/:id/retry', async (req, res) => {
  try {
    const payout = await SellerPayout.findById(req.params.id).populate('sellerId', 'sellerProfile.bankDetails');
    if (!payout) return res.status(404).json({ message: 'Payout not found' });
    if (!['failed', 'on_hold'].includes(payout.status)) {
      return res.status(400).json({ message: 'Can only retry failed or on-hold payouts' });
    }

    // Update bank details snapshot from seller's current data
    const bank = payout.sellerId?.sellerProfile?.bankDetails;
    if (bank?.accountNumber && bank?.ifscCode) {
      payout.bankDetailsSnapshot = bank;
    }

    payout.status = 'pending';
    payout.holdReason = '';
    payout.failureDetails = '';
    await payout.save();

    logActivity({ domain: 'admin', action: 'payout_retry', actorRole: 'admin', actorId: req.user._id, actorEmail: req.user.email, targetType: 'SellerPayout', targetId: payout._id, message: `Payout retried`, metadata: { amount: payout.netPayout } });
    res.json({ message: 'Payout moved to pending', payout });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- PAYOUT RECONCILIATION ----
router.get('/payouts/reconciliation', async (req, res) => {
  try {
    // Order-level breakdown by payoutStatus
    const orderStats = await Order.aggregate([
      { $match: { paymentStatus: 'paid', status: 'delivered' } },
      { $group: {
        _id: '$payoutStatus',
        count: { $sum: 1 },
        totalAmount: { $sum: { $ifNull: ['$sellerAmount', 0] } }
      }}
    ]);

    const ordersByStatus = {};
    for (const stat of orderStats) {
      ordersByStatus[stat._id || 'unknown'] = { count: stat.count, totalAmount: stat.totalAmount };
    }

    // Payout-level breakdown by status
    const payoutStats = await SellerPayout.aggregate([
      { $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalNetPayout: { $sum: '$netPayout' }
      }}
    ]);

    const payoutsByStatus = {};
    for (const stat of payoutStats) {
      payoutsByStatus[stat._id] = { count: stat.count, totalNetPayout: stat.totalNetPayout };
    }

    // Orphaned orders: included_in_payout but payoutId is null
    const orphanedNullPayoutId = await Order.countDocuments({
      payoutStatus: 'included_in_payout',
      $or: [{ payoutId: null }, { payoutId: { $exists: false } }]
    });

    // Orphaned orders: payoutId references a non-existent payout
    const ordersWithPayoutId = await Order.find(
      { payoutStatus: 'included_in_payout', payoutId: { $ne: null } },
      { payoutId: 1 }
    ).lean();

    const payoutIds = [...new Set(ordersWithPayoutId.map(o => o.payoutId?.toString()).filter(Boolean))];
    let orphanedMissingPayout = 0;
    if (payoutIds.length) {
      const existingPayouts = await SellerPayout.find(
        { _id: { $in: payoutIds } },
        { _id: 1 }
      ).lean();
      const existingIds = new Set(existingPayouts.map(p => p._id.toString()));
      const missingIds = payoutIds.filter(id => !existingIds.has(id));
      if (missingIds.length) {
        orphanedMissingPayout = await Order.countDocuments({
          payoutStatus: 'included_in_payout',
          payoutId: { $in: missingIds }
        });
      }
    }

    res.json({
      orders: ordersByStatus,
      payouts: payoutsByStatus,
      orphaned: {
        nullPayoutId: orphanedNullPayoutId,
        missingPayout: orphanedMissingPayout,
        total: orphanedNullPayoutId + orphanedMissingPayout
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ---- USERS ----
router.get('/users', async (req, res) => {
  try {
    const users = await Customer.find().sort({ createdAt: -1 }).select('-otp -otpExpiry');
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
      { $match: {} },
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
      const safeSearch = escapeRegex(search);
      pipeline.splice(1, 0, {
        $match: {
          $or: [
            { name: { $regex: safeSearch, $options: 'i' } },
            { email: { $regex: safeSearch, $options: 'i' } }
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
    const countResult = await Customer.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Sort by highest spender, then paginate
    pipeline.push({ $sort: { totalSpent: -1, createdAt: -1 } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });

    const customers = await Customer.aggregate(pipeline);

    // Summary stats
    const summaryPipeline = [
      { $match: {} },
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
    const summaryResult = await Customer.aggregate(summaryPipeline);
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
    logger.error('Customer analytics error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- SELLER HEALTH METRICS ----
router.get('/sellers/:id/health', async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id).select('sellerProfile.metrics sellerProfile.businessName sellerProfile.suspensionType sellerProfile.suspensionReason status');
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

// =================== CORPORATE ADMIN ===================

// GET /api/admin/corporate/dashboard
router.get('/corporate/dashboard', async (req, res) => {
  try {
    const totalCorporateUsers = await CorporateUser.countDocuments();
    const pendingApproval = await CorporateUser.countDocuments({ status: 'pending_approval' });
    const activeCorporate = await CorporateUser.countDocuments({ status: 'active' });
    const catalogSize = await CorporateCatalog.countDocuments({ isActive: true });
    const totalQuotes = await CorporateQuote.countDocuments();
    const pendingQuotes = await CorporateQuote.countDocuments({ status: 'sent' });
    const convertedQuotes = await CorporateQuote.countDocuments({ status: 'converted' });

    const b2bOrderAgg = await Order.aggregate([
      { $match: { orderType: 'b2b_direct', paymentStatus: 'paid' } },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
    ]);
    const b2bStats = b2bOrderAgg[0] || { revenue: 0, count: 0 };

    res.json({
      stats: {
        totalCorporateUsers, pendingApproval, activeCorporate, catalogSize,
        totalQuotes, pendingQuotes, convertedQuotes,
        b2bRevenue: b2bStats.revenue, b2bOrders: b2bStats.count
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- CORPORATE USERS ----
router.get('/corporate/users', async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status && typeof status === 'string') filter.status = status;
    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { companyName: { $regex: safeSearch, $options: 'i' } },
        { contactPerson: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const users = await CorporateUser.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).select('-otp -otpExpiry');
    const total = await CorporateUser.countDocuments(filter);

    res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/corporate/users/from-inquiry -- create corporate user from B2B inquiry
router.post('/corporate/users/from-inquiry', async (req, res) => {
  try {
    const { inquiryId } = req.body;
    if (!inquiryId) return res.status(400).json({ message: 'Inquiry ID required' });

    const inquiry = await B2BInquiry.findById(inquiryId);
    if (!inquiry) return res.status(404).json({ message: 'Inquiry not found' });

    // Check if already converted
    if (inquiry.convertedCorporateUserId) {
      return res.status(400).json({ message: 'This inquiry has already been converted to a corporate user' });
    }

    // Check if corporate user already exists with this email
    const existing = await CorporateUser.findOne({ email: inquiry.email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ message: `Corporate user already exists for ${inquiry.email}` });
    }

    // Create corporate user (pre-approved)
    const user = new CorporateUser({
      companyName: inquiry.companyName,
      contactPerson: inquiry.contactPerson,
      email: inquiry.email.toLowerCase().trim(),
      phone: inquiry.phone || '',
      status: 'active',
      approvedBy: req.user._id,
      approvedAt: new Date()
    });
    await user.save();

    // Update inquiry to converted
    inquiry.status = 'converted';
    inquiry.convertedCorporateUserId = user._id;
    inquiry.convertedAt = new Date();
    inquiry.activityLog.push({
      action: `Corporate account created for ${inquiry.email}`,
      timestamp: new Date(),
      by: req.user._id
    });
    await inquiry.save();

    // Send welcome email (non-blocking)
    try {
      await sendCorporateWelcomeEmail(inquiry.email, inquiry.companyName, inquiry.contactPerson);
    } catch (e) { logger.error('Corporate welcome email failed:', e.message); }

    logActivity({ domain: 'admin', action: 'corporate_user_created_from_inquiry', actorRole: 'admin', actorId: req.user._id, actorEmail: req.user.email, targetType: 'CorporateUser', targetId: user._id, message: `Corporate user created from inquiry: ${inquiry.companyName} (${inquiry.email})` });

    res.status(201).json({ user, message: 'Corporate account created and welcome email sent' });
  } catch (err) {
    logger.error('Create corporate user from inquiry error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/corporate/users/:id/approve', async (req, res) => {
  try {
    const user = await CorporateUser.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Corporate user not found' });

    user.status = 'active';
    user.approvedBy = req.user._id;
    user.approvedAt = new Date();
    await user.save();

    logActivity({ domain: 'admin', action: 'corporate_user_approved', actorRole: 'admin', actorId: req.user._id, actorEmail: req.user.email, targetType: 'CorporateUser', targetId: user._id, message: `Corporate user ${user.companyName} approved` });
    res.json({ message: 'Corporate user approved', user });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/corporate/users/:id/suspend', async (req, res) => {
  try {
    const user = await CorporateUser.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Corporate user not found' });

    user.status = 'suspended';
    user.notes = req.body.reason || 'Suspended by admin';
    await user.save();

    logActivity({ domain: 'admin', action: 'corporate_user_suspended', actorRole: 'admin', actorId: req.user._id, actorEmail: req.user.email, targetType: 'CorporateUser', targetId: user._id, message: `Corporate user ${user.companyName} suspended` });
    res.json({ message: 'Corporate user suspended', user });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- CORPORATE CATALOG ----
router.get('/corporate/catalog', async (req, res) => {
  try {
    const entries = await CorporateCatalog.find()
      .populate('productId', 'title price images stock isActive category')
      .populate('addedBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ catalog: entries });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/corporate/catalog', async (req, res) => {
  try {
    const { productId, corporatePrice, minOrderQty, maxOrderQty, tags } = req.body;
    if (!productId) return res.status(400).json({ message: 'Product ID required' });

    const existing = await CorporateCatalog.findOne({ productId });
    if (existing) return res.status(400).json({ message: 'Product already in corporate catalog' });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const entry = new CorporateCatalog({
      productId,
      corporatePrice: corporatePrice || null,
      minOrderQty: minOrderQty || 10,
      maxOrderQty: maxOrderQty || 10000,
      tags: tags || [],
      addedBy: req.user._id
    });
    await entry.save();

    logActivity({ domain: 'admin', action: 'corporate_catalog_add', actorRole: 'admin', actorId: req.user._id, actorEmail: req.user.email, targetType: 'CorporateCatalog', targetId: entry._id, message: `Product ${productId} added to corporate catalog` });
    res.status(201).json({ entry, message: 'Product added to corporate catalog' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/corporate/catalog/:id', async (req, res) => {
  try {
    const { corporatePrice, minOrderQty, maxOrderQty, tags, isActive } = req.body;
    const entry = await CorporateCatalog.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Catalog entry not found' });

    if (corporatePrice !== undefined) entry.corporatePrice = corporatePrice || null;
    if (minOrderQty !== undefined) entry.minOrderQty = minOrderQty;
    if (maxOrderQty !== undefined) entry.maxOrderQty = maxOrderQty;
    if (tags !== undefined) entry.tags = tags;
    if (isActive !== undefined) entry.isActive = isActive;
    await entry.save();

    res.json({ entry, message: 'Catalog entry updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/corporate/catalog/:id', async (req, res) => {
  try {
    await CorporateCatalog.findByIdAndDelete(req.params.id);
    logActivity({ domain: 'admin', action: 'corporate_catalog_remove', actorRole: 'admin', actorId: req.user._id, actorEmail: req.user.email, targetType: 'CorporateCatalog', targetId: req.params.id, message: `Product removed from corporate catalog` });
    res.json({ message: 'Removed from corporate catalog' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---- CORPORATE QUOTES ----
router.get('/corporate/quotes', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && typeof status === 'string') filter.status = status;

    const quotes = await CorporateQuote.find(filter)
      .sort({ createdAt: -1 })
      .populate('corporateUserId', 'companyName email')
      .populate('createdBy', 'name');
    res.json({ quotes });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/corporate/quotes', async (req, res) => {
  try {
    const { companyName, contactEmail, contactPhone, corporateUserId, inquiryId, items, discountPercent, validUntil, adminNotes } = req.body;

    if (!companyName || !contactEmail) return res.status(400).json({ message: 'Company name and email required' });
    if (!items || !items.length) return res.status(400).json({ message: 'At least one item required' });

    // Build items with product details
    const quoteItems = [];
    let totalAmount = 0;
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) continue;
      const unitPrice = item.unitPrice || product.price;
      const subtotal = unitPrice * (item.quantity || 1);
      quoteItems.push({
        productId: product._id,
        title: product.title,
        image: product.images?.[0]?.url || '',
        unitPrice,
        quantity: item.quantity || 1,
        subtotal
      });
      totalAmount += subtotal;
    }

    const discount = discountPercent ? Math.round(totalAmount * discountPercent / 100) : 0;
    const finalAmount = totalAmount - discount;

    // Generate quote number
    const d = new Date();
    const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const rand = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
    const quoteNumber = `GFT-Q-${date}-${rand}`;

    const quote = new CorporateQuote({
      quoteNumber,
      inquiryId: inquiryId || null,
      corporateUserId: corporateUserId || null,
      companyName,
      contactEmail,
      contactPhone: contactPhone || '',
      items: quoteItems,
      totalAmount,
      discountPercent: discountPercent || 0,
      finalAmount,
      status: 'sent',
      validUntil: validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
      adminNotes: adminNotes || '',
      createdBy: req.user._id
    });
    await quote.save();

    // Send quote notification email
    try {
      await sendCorporateQuoteNotification(contactEmail, quote, 'created');
    } catch (e) { logger.error('Quote notification email error:', e.message); }

    logActivity({ domain: 'admin', action: 'corporate_quote_created', actorRole: 'admin', actorId: req.user._id, actorEmail: req.user.email, targetType: 'CorporateQuote', targetId: quote._id, message: `Quote ${quoteNumber} created for ${companyName}`, metadata: { quoteNumber, finalAmount } });
    res.status(201).json({ quote, message: 'Quote created and sent' });
  } catch (err) {
    logger.error('Create quote error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/corporate/quotes/:id', async (req, res) => {
  try {
    const quote = await CorporateQuote.findById(req.params.id);
    if (!quote) return res.status(404).json({ message: 'Quote not found' });

    const { items, discountPercent, validUntil, adminNotes, status } = req.body;

    if (items) {
      quote.items = items;
      quote.totalAmount = items.reduce((s, i) => s + (i.subtotal || i.unitPrice * i.quantity), 0);
    }
    if (discountPercent !== undefined) {
      quote.discountPercent = discountPercent;
      const discount = Math.round(quote.totalAmount * discountPercent / 100);
      quote.finalAmount = quote.totalAmount - discount;
    }
    if (validUntil) quote.validUntil = new Date(validUntil);
    if (adminNotes !== undefined) quote.adminNotes = adminNotes;
    if (status) quote.status = status;

    await quote.save();

    // Send quote update notification email
    try {
      await sendCorporateQuoteNotification(quote.contactEmail, quote, 'updated');
    } catch (e) { logger.error('Quote update notification email error:', e.message); }

    logActivity({ domain: 'admin', action: 'corporate_quote_updated', actorRole: 'admin', actorId: req.user._id, actorEmail: req.user.email, targetType: 'CorporateQuote', targetId: quote._id, message: `Quote ${quote.quoteNumber} updated` });
    res.json({ quote, message: 'Quote updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// =================== AUDIT LOGS ===================
const ActivityLog = require('../models/ActivityLog');
const AuthAuditLog = require('../models/AuthAuditLog');
const OtpLog = require('../models/OtpLog');

// GET /api/admin/logs/activity
router.get('/logs/activity', async (req, res) => {
  try {
    const { domain, action, actorRole, page = 1, limit = 50, from, to } = req.query;
    const filter = {};
    if (domain && typeof domain === 'string') filter.domain = domain;
    if (action) filter.action = { $regex: escapeRegex(action), $options: 'i' };
    if (actorRole && typeof actorRole === 'string') filter.actorRole = actorRole;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      ActivityLog.countDocuments(filter)
    ]);
    res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/logs/auth
router.get('/logs/auth', async (req, res) => {
  try {
    const { action, email, role, page = 1, limit = 50, from, to } = req.query;
    const filter = {};
    if (action && typeof action === 'string') filter.action = action;
    if (email) filter.email = { $regex: escapeRegex(email), $options: 'i' };
    if (role && typeof role === 'string') filter.role = role;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      AuthAuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      AuthAuditLog.countDocuments(filter)
    ]);
    res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/logs/otp
router.get('/logs/otp', async (req, res) => {
  try {
    const { email, event, role, page = 1, limit = 50, from, to } = req.query;
    const filter = {};
    if (email) filter.email = { $regex: escapeRegex(email), $options: 'i' };
    if (event && typeof event === 'string') filter.event = event;
    if (role && typeof role === 'string') filter.role = role;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      OtpLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      OtpLog.countDocuments(filter)
    ]);
    res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
