const express = require('express');
const Product = require('../models/Product');
const Order = require('../models/Order');
const SellerPayout = require('../models/SellerPayout');
const PlatformSettings = require('../models/PlatformSettings');
const { requireAuth, requireSeller } = require('../middleware/auth');
const { uploadImage, uploadVideo, deleteImage, deleteVideo, deleteMedia } = require('../config/cloudinary');
const { slugify } = require('../utils/slugify');
const { getCommissionRate } = require('../utils/commission');
const { sanitizeBody } = require('../middleware/sanitize');
const router = express.Router();

router.use(requireAuth, requireSeller);

// GET /api/seller/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const sellerId = req.user._id;
    const settings = await PlatformSettings.getSettings();
    const commissionRate = getCommissionRate(req.user, settings);

    const totalOrders = await Order.countDocuments({ sellerId, paymentStatus: 'paid' });
    const totalSalesAgg = await Order.aggregate([
      { $match: { sellerId: req.user._id, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, commission: { $sum: '$commissionAmount' }, sellerEarnings: { $sum: '$sellerAmount' } } }
    ]);

    const stats = totalSalesAgg[0] || { total: 0, commission: 0, sellerEarnings: 0 };
    const pendingOrders = await Order.countDocuments({ sellerId, status: { $in: ['pending', 'confirmed', 'processing'] } });
    const totalProducts = await Product.countDocuments({ sellerId });
    const activeProducts = await Product.countDocuments({ sellerId, isActive: true });

    // Pending payout earnings (delivered but not yet in a payout)
    const pendingPayoutAgg = await Order.aggregate([
      { $match: { sellerId: req.user._id, paymentStatus: 'paid', status: 'delivered', payoutStatus: 'pending' } },
      { $group: { _id: null, total: { $sum: '$sellerAmount' }, count: { $sum: 1 },
        totalSales: { $sum: { $ifNull: ['$itemTotal', '$totalAmount'] } },
        commissionDeducted: { $sum: { $ifNull: ['$commissionAmount', 0] } },
        gatewayFees: { $sum: { $ifNull: ['$paymentGatewayFee', 0] } },
        shippingDeducted: { $sum: { $cond: [{ $eq: ['$shippingPaidBy', 'seller'] }, { $ifNull: ['$shippingCost', 0] }, 0] } }
      }}
    ]);
    const pendingPayout = pendingPayoutAgg[0] || { total: 0, count: 0, totalSales: 0, commissionDeducted: 0, gatewayFees: 0, shippingDeducted: 0 };

    // Lifetime earnings from paid payouts
    const SellerPayout = require('../models/SellerPayout');
    const lifetimeAgg = await SellerPayout.aggregate([
      { $match: { sellerId: req.user._id, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$netPayout' } } }
    ]);
    const lifetimeEarnings = lifetimeAgg[0]?.total || 0;

    // Next payout date
    const schedule = settings.payoutSchedule || 'biweekly';
    const now = new Date();
    let nextPayoutDate;
    if (schedule === 'weekly') {
      nextPayoutDate = new Date(now);
      nextPayoutDate.setDate(now.getDate() + ((1 + 7 - now.getDay()) % 7 || 7));
    } else if (schedule === 'biweekly') {
      const day = now.getDate();
      if (day < 15) { nextPayoutDate = new Date(now.getFullYear(), now.getMonth(), 15); }
      else { nextPayoutDate = new Date(now.getFullYear(), now.getMonth() + 1, 1); }
    } else {
      nextPayoutDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    const recentOrders = await Order.find({ sellerId }).sort({ createdAt: -1 }).limit(10).select('orderNumber status totalAmount sellerAmount createdAt items');

    const freshUser = await Seller.findById(sellerId);
    const bank = freshUser?.sellerProfile?.bankDetails;
    const bankDetailsComplete = !!(bank?.accountHolderName && bank?.accountNumber && bank?.ifscCode && bank?.bankName);

    res.json({
      stats: {
        totalSales: stats.total,
        totalOrders,
        totalCommissionPaid: stats.commission,
        totalEarnings: stats.sellerEarnings,
        pendingOrders,
        totalProducts,
        activeProducts
      },
      currentPeriodEarnings: {
        totalSales: pendingPayout.totalSales,
        commissionDeducted: pendingPayout.commissionDeducted,
        gatewayFees: pendingPayout.gatewayFees,
        shippingDeducted: pendingPayout.shippingDeducted,
        netEarning: Math.max(0, pendingPayout.total - pendingPayout.shippingDeducted),
        pendingAmount: Math.max(0, pendingPayout.total - pendingPayout.shippingDeducted),
        pendingOrderCount: pendingPayout.count
      },
      lifetimeEarnings,
      nextPayoutDate: nextPayoutDate.toISOString(),
      payoutSchedule: schedule,
      bankDetailsComplete,
      yourCommissionRate: commissionRate,
      minimumProductPrice: settings.minimumProductPrice || 200,
      recentOrders
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/seller/products
router.get('/products', async (req, res) => {
  try {
    const products = await Product.find({ sellerId: req.user._id }).sort({ createdAt: -1 });
    res.json({ products });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/seller/products
router.post('/products', sanitizeBody, async (req, res) => {
  try {
    const sellerId = req.user._id;
    const data = { ...req.body, sellerId };
    data.slug = slugify(data.title);
    const sellerFolder = `giftsity/products/${sellerId}`;

    const uploadedImages = [];
    const uploadedMedia = [];

    // Handle image uploads
    if (data.newImages && Array.isArray(data.newImages)) {
      for (const img of data.newImages) {
        if (img.startsWith('data:')) {
          const result = await uploadImage(img, { folder: sellerFolder });
          uploadedImages.push(result);
          uploadedMedia.push({ type: 'image', url: result.url, publicId: result.publicId });
        }
      }
      delete data.newImages;
    }

    // Handle video uploads
    if (data.newVideos && Array.isArray(data.newVideos)) {
      for (const vid of data.newVideos) {
        if (vid.startsWith('data:')) {
          const result = await uploadVideo(vid, { folder: `${sellerFolder}/videos` });
          uploadedMedia.push({ type: 'video', url: result.url, thumbnailUrl: result.thumbnailUrl, publicId: result.publicId, duration: result.duration, width: result.width, height: result.height });
        }
      }
      delete data.newVideos;
    }

    if (uploadedImages.length > 0) data.images = uploadedImages;
    if (uploadedMedia.length > 0) data.media = uploadedMedia;

    // Validate minimum product price
    if (data.price) {
      const platformSettings = await PlatformSettings.getSettings();
      if (Number(data.price) < (platformSettings.minimumProductPrice || 0)) {
        return res.status(400).json({ message: `Minimum product price is Rs. ${platformSettings.minimumProductPrice}` });
      }
    }

    const product = new Product(data);
    await product.save();
    res.status(201).json({ product, message: 'Product created' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/seller/products/:id
router.put('/products/:id', sanitizeBody, async (req, res) => {
  try {
    const sellerId = req.user._id;
    const product = await Product.findOne({ _id: req.params.id, sellerId });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const data = { ...req.body, updatedAt: Date.now() };
    const sellerFolder = `giftsity/products/${sellerId}`;

    // Handle new image uploads
    if (data.newImages && Array.isArray(data.newImages)) {
      const uploaded = [];
      for (const img of data.newImages) {
        if (img.startsWith('data:')) {
          const result = await uploadImage(img, { folder: sellerFolder });
          uploaded.push(result);
        }
      }
      data.images = [...(data.existingImages || []), ...uploaded];
      delete data.newImages;
      delete data.existingImages;
    }

    // Handle new video uploads
    if (data.newVideos && Array.isArray(data.newVideos)) {
      const uploadedMedia = [];
      for (const vid of data.newVideos) {
        if (vid.startsWith('data:')) {
          const result = await uploadVideo(vid, { folder: `${sellerFolder}/videos` });
          uploadedMedia.push({ type: 'video', url: result.url, thumbnailUrl: result.thumbnailUrl, publicId: result.publicId, duration: result.duration, width: result.width, height: result.height });
        }
      }
      data.media = [...(data.existingMedia || []), ...uploadedMedia];
      delete data.newVideos;
      delete data.existingMedia;
    }

    // Handle deleted images
    if (data.deletedImageIds && Array.isArray(data.deletedImageIds)) {
      for (const publicId of data.deletedImageIds) {
        await deleteImage(publicId);
      }
      delete data.deletedImageIds;
    }

    // Handle deleted media (images + videos)
    if (data.deletedMediaIds && Array.isArray(data.deletedMediaIds)) {
      for (const item of data.deletedMediaIds) {
        if (typeof item === 'object' && item.publicId) {
          await deleteMedia(item.publicId, item.type || 'image');
        } else if (typeof item === 'string') {
          await deleteImage(item);
        }
      }
      delete data.deletedMediaIds;
    }

    // Validate minimum product price
    if (data.price) {
      const platformSettings = await PlatformSettings.getSettings();
      if (Number(data.price) < (platformSettings.minimumProductPrice || 0)) {
        return res.status(400).json({ message: `Minimum product price is Rs. ${platformSettings.minimumProductPrice}` });
      }
    }

    Object.assign(product, data);
    await product.save();
    res.json({ product, message: 'Product updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/seller/products/:id
router.delete('/products/:id', async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, sellerId: req.user._id });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Clean up all Cloudinary assets (deduplicated to avoid double-deletion)
    const deletedIds = new Set();
    for (const img of product.images || []) {
      if (img.publicId && !deletedIds.has(img.publicId)) {
        deletedIds.add(img.publicId);
        await deleteImage(img.publicId);
      }
    }
    for (const m of product.media || []) {
      if (m.publicId && !deletedIds.has(m.publicId)) {
        deletedIds.add(m.publicId);
        await deleteMedia(m.publicId, m.type || 'image');
      }
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/seller/orders
router.get('/orders', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { sellerId: req.user._id };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const orders = await Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).populate('customerId', 'name email phone');
    const total = await Order.countDocuments(filter);

    res.json({ orders, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/seller/orders/:id/ship
router.put('/orders/:id/ship', async (req, res) => {
  try {
    const { courierName, trackingNumber, estimatedDelivery } = req.body;
    const order = await Order.findOne({ _id: req.params.id, sellerId: req.user._id });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const { isValidTransition } = require('../utils/orderStatus');
    if (!isValidTransition(order.status, 'shipped')) {
      return res.status(400).json({ message: `Cannot ship order with status "${order.status}"` });
    }

    order.status = 'shipped';
    order.trackingInfo = {
      courierName: courierName || '',
      trackingNumber: trackingNumber || '',
      shippedAt: new Date(),
      estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null
    };
    await order.save();
    res.json({ order, message: 'Order marked as shipped' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/seller/payouts
router.get('/payouts', async (req, res) => {
  try {
    const payouts = await SellerPayout.find({ sellerId: req.user._id }).sort({ createdAt: -1 });
    res.json({ payouts });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/seller/settings
router.get('/settings', async (req, res) => {
  try {
    const user = await Seller.findById(req.user._id);
    res.json({
      sellerProfile: user.sellerProfile,
      name: user.name,
      phone: user.phone,
      email: user.email
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/seller/settings
router.put('/settings', sanitizeBody, async (req, res) => {
  try {
    const { businessName, businessAddress, pickupAddress, bankDetails, phone } = req.body;
    const user = req.user;

    if (businessName) user.sellerProfile.businessName = businessName;
    if (businessAddress) user.sellerProfile.businessAddress = businessAddress;
    if (pickupAddress) user.sellerProfile.pickupAddress = pickupAddress;
    if (bankDetails) {
      // Validate bank details
      if (bankDetails.ifscCode) {
        const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
        if (!ifscRegex.test(bankDetails.ifscCode.toUpperCase())) {
          return res.status(400).json({ message: 'Invalid IFSC code. Must be 11 characters (e.g., SBIN0001234).' });
        }
        bankDetails.ifscCode = bankDetails.ifscCode.toUpperCase();
      }
      if (bankDetails.accountNumber) {
        const acctClean = bankDetails.accountNumber.replace(/\s/g, '');
        if (!/^\d{9,18}$/.test(acctClean)) {
          return res.status(400).json({ message: 'Invalid account number. Must be 9-18 digits.' });
        }
        bankDetails.accountNumber = acctClean;
      }
      user.sellerProfile.bankDetails = bankDetails;

      // Auto-unhold payouts when bank details are added/fixed
      const isBankComplete = bankDetails.accountHolderName && bankDetails.accountNumber && bankDetails.ifscCode && bankDetails.bankName;
      if (isBankComplete) {
        try {
          const SellerPayout = require('../models/SellerPayout');
          const onHoldPayouts = await SellerPayout.find({ sellerId: user._id, status: 'on_hold', holdReason: 'missing_bank_details' });
          for (const payout of onHoldPayouts) {
            payout.status = 'pending';
            payout.holdReason = '';
            payout.bankDetailsSnapshot = bankDetails;
            await payout.save();
          }
        } catch (payoutErr) {
          // Non-critical
        }
      }
    }
    if (phone) user.phone = phone;

    await user.save();
    res.json({ message: 'Settings updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/seller/marketing
router.get('/marketing', async (req, res) => {
  try {
    const user = req.user;
    res.json({
      referralCode: user.sellerProfile.referralCode,
      referralCount: user.sellerProfile.referralCount || 0,
      referralLink: `${process.env.CLIENT_URL}/seller/join?ref=${user.sellerProfile.referralCode}`,
      rewards: {
        featured: user.sellerProfile.referralCount >= 3,
        credit: user.sellerProfile.referralCount >= 5,
        lockedRate: user.sellerProfile.referralCount >= 10
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Need Seller model for settings route
const Seller = require('../models/Seller');

// POST /api/seller/request-unsuspend - request suspension removal
router.post('/request-unsuspend', async (req, res) => {
  try {
    const user = req.user;
    if (user.status !== 'suspended') {
      return res.status(400).json({ message: 'Your account is not suspended' });
    }
    const { reason } = req.body;
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ message: 'Please provide a detailed reason (at least 10 characters)' });
    }

    user.sellerProfile.suspensionRemovalRequested = true;
    user.sellerProfile.suspensionRemovalReason = reason.trim();
    await user.save();

    res.json({ message: 'Suspension removal request submitted. Admin will review your request.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
