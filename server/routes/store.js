const express = require('express');
const User = require('../models/User');
const Product = require('../models/Product');
const Review = require('../models/Review');
const Order = require('../models/Order');
const router = express.Router();

// GET /api/store/top-sellers - featured sellers for homepage
router.get('/featured/top-sellers', async (req, res) => {
  try {
    const sellers = await User.find({
      userType: 'seller',
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

// GET /api/store/:slug - public seller store page
router.get('/:slug', async (req, res) => {
  try {
    const seller = await User.findOne({
      'sellerProfile.businessSlug': req.params.slug,
      userType: 'seller',
      status: 'active'
    }).select('-otp -otpExpiry -sellerProfile.bankDetails');

    if (!seller) return res.status(404).json({ message: 'Store not found' });

    // Get product count
    const productCount = await Product.countDocuments({ sellerId: seller._id, isActive: true });

    // Get order stats
    const deliveredOrders = seller.sellerProfile.deliveredOrders || 0;
    const failedOrders = seller.sellerProfile.failedOrders || 0;

    res.json({
      store: {
        _id: seller._id,
        name: seller.name,
        businessName: seller.sellerProfile.businessName,
        businessSlug: seller.sellerProfile.businessSlug,
        bio: seller.sellerProfile.bio,
        avatar: seller.sellerProfile.avatar,
        coverImage: seller.sellerProfile.coverImage,
        city: seller.sellerProfile.businessAddress?.city || '',
        state: seller.sellerProfile.businessAddress?.state || '',
        rating: seller.sellerProfile.rating,
        isVerified: seller.sellerProfile.isVerified,
        totalOrders: seller.sellerProfile.totalOrders,
        totalSales: seller.sellerProfile.totalSales,
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
router.get('/:slug/products', async (req, res) => {
  try {
    const { page = 1, limit = 24 } = req.query;
    const seller = await User.findOne({ 'sellerProfile.businessSlug': req.params.slug, userType: 'seller' });
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
router.get('/:slug/reviews', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const seller = await User.findOne({ 'sellerProfile.businessSlug': req.params.slug, userType: 'seller' });
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
