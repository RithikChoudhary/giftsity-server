const express = require('express');
const mongoose = require('mongoose');
const Seller = require('../models/Seller');
const Product = require('../models/Product');
const Review = require('../models/Review');
const Order = require('../models/Order');
const PlatformSettings = require('../models/PlatformSettings');
const { cacheMiddleware } = require('../middleware/cache');
const router = express.Router();

// Helper: find seller by businessSlug OR ObjectId
function sellerQuery(slug, requireActive = true) {
  const base = {};
  if (requireActive) base.status = 'active';
  if (mongoose.Types.ObjectId.isValid(slug) && slug.length === 24) {
    return { ...base, $or: [{ _id: slug }, { 'sellerProfile.businessSlug': slug }] };
  }
  return { ...base, 'sellerProfile.businessSlug': slug };
}

// GET /api/store/info - public platform info (social links, contact)
router.get('/info', cacheMiddleware(600), async (req, res) => {
  try {
    const settings = await PlatformSettings.getSettings();
    res.json({
      platformName: settings.platformName || 'Giftsity',
      tagline: settings.tagline || '',
      supportEmail: settings.supportEmail || '',
      supportPhone: settings.supportPhone || '',
      instagramUrl: settings.instagramUrl || '',
      facebookUrl: settings.facebookUrl || '',
      whatsappNumber: settings.whatsappNumber || ''
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/store/top-sellers - featured sellers for homepage
router.get('/featured/top-sellers', cacheMiddleware(300), async (req, res) => {
  try {
    const sellers = await Seller.find({
      status: 'active',
      'sellerProfile.businessSlug': { $ne: '' }
    })
      .sort({ 'sellerProfile.totalOrders': -1 })
      .limit(6)
      .select('name sellerProfile.businessName sellerProfile.businessSlug sellerProfile.avatar sellerProfile.bio sellerProfile.rating sellerProfile.isVerified sellerProfile.totalOrders sellerProfile.businessAddress.city');

    const formatted = await Promise.all(sellers.map(async s => {
      const productCount = await Product.countDocuments({ sellerId: s._id, isActive: true });
      return {
        _id: s._id,
        name: s.name,
        businessName: s.sellerProfile.businessName,
        businessSlug: s.sellerProfile.businessSlug,
        avatar: s.sellerProfile.avatar,
        bio: s.sellerProfile.bio,
        rating: s.sellerProfile.rating,
        isVerified: s.sellerProfile.isVerified,
        totalOrders: s.sellerProfile.totalOrders,
        city: s.sellerProfile.businessAddress?.city,
        productCount
      };
    }));

    res.json({ sellers: formatted });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/store/sellers - all active sellers (public, paginated)
router.get('/sellers', cacheMiddleware(120), async (req, res) => {
  try {
    const { page = 1, limit = 24, sort = 'orders' } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const filter = {
      status: 'active',
      'sellerProfile.businessSlug': { $ne: '' }
    };

    let sortObj;
    switch (sort) {
      case 'rating': sortObj = { 'sellerProfile.rating': -1 }; break;
      case 'newest': sortObj = { createdAt: -1 }; break;
      case 'orders':
      default: sortObj = { 'sellerProfile.totalOrders': -1 }; break;
    }

    const total = await Seller.countDocuments(filter);
    const sellers = await Seller.find(filter)
      .sort(sortObj)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .select('name sellerProfile.businessName sellerProfile.businessSlug sellerProfile.avatar sellerProfile.bio sellerProfile.rating sellerProfile.isVerified sellerProfile.totalOrders sellerProfile.businessAddress.city createdAt');

    const formatted = await Promise.all(sellers.map(async s => {
      const productCount = await Product.countDocuments({ sellerId: s._id, isActive: true });
      return {
        _id: s._id,
        name: s.name,
        businessName: s.sellerProfile.businessName,
        businessSlug: s.sellerProfile.businessSlug,
        avatar: s.sellerProfile.avatar,
        bio: s.sellerProfile.bio,
        rating: s.sellerProfile.rating,
        isVerified: s.sellerProfile.isVerified,
        totalOrders: s.sellerProfile.totalOrders,
        city: s.sellerProfile.businessAddress?.city,
        productCount,
        joinedAt: s.createdAt
      };
    }));

    res.json({ sellers: formatted, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/store/:slug - public seller store page
router.get('/:slug', cacheMiddleware(120), async (req, res) => {
  try {
    const seller = await Seller.findOne(sellerQuery(req.params.slug))
      .select('-otp -otpExpiry -sellerProfile.bankDetails');

    if (!seller) return res.status(404).json({ message: 'Store not found' });

    // Get product count
    const productCount = await Product.countDocuments({ sellerId: seller._id, isActive: true });

    // Get order stats
    const sp = seller.sellerProfile || {};
    const deliveredOrders = sp.deliveredOrders || 0;
    const failedOrders = sp.failedOrders || 0;

    res.json({
      store: {
        _id: seller._id,
        name: seller.name,
        businessName: sp.businessName,
        businessSlug: sp.businessSlug,
        businessType: sp.businessType || 'Individual',
        bio: sp.bio,
        avatar: sp.avatar,
        profilePhoto: sp.profilePhoto || sp.avatar?.url || '',
        coverImage: sp.coverImage,
        instagramUsername: sp.instagramUsername || '',
        city: sp.businessAddress?.city || '',
        state: sp.businessAddress?.state || '',
        gstNumber: sp.gstNumber || '',
        rating: sp.rating,
        isVerified: sp.isVerified,
        totalOrders: sp.totalOrders,
        totalSales: sp.totalSales,
        deliveredOrders,
        failedOrders,
        productCount,
        joinedAt: seller.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/store/:slug/products - seller's products (Instagram grid)
router.get('/:slug/products', cacheMiddleware(60), async (req, res) => {
  try {
    const { page = 1, limit = 24 } = req.query;
    const seller = await Seller.findOne(sellerQuery(req.params.slug, false));
    if (!seller) return res.status(404).json({ message: 'Store not found' });

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const products = await Product.find({ sellerId: seller._id, isActive: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('title slug images media price comparePrice averageRating reviewCount stock category createdAt');

    const total = await Product.countDocuments({ sellerId: seller._id, isActive: true });

    res.json({ products, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/store/:slug/reviews - reviews for seller's products
router.get('/:slug/reviews', cacheMiddleware(120), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const seller = await Seller.findOne(sellerQuery(req.params.slug, false));
    if (!seller) return res.status(404).json({ message: 'Store not found' });

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const reviews = await Review.find({ sellerId: seller._id, isHidden: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('customerId', 'name')
      .populate('productId', 'title slug images');

    const total = await Review.countDocuments({ sellerId: seller._id, isHidden: false });

    // Aggregate rating distribution
    const ratingDist = await Review.aggregate([
      { $match: { sellerId: seller._id, isHidden: false } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } }
    ]);

    res.json({ reviews, total, ratingDistribution: ratingDist, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
