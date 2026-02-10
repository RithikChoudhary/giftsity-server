const express = require('express');
const Product = require('../models/Product');
const Category = require('../models/Category');
const router = express.Router();

// GET /api/products - public product listing
router.get('/', async (req, res) => {
  try {
    const { category, minPrice, maxPrice, seller, search, featured, sort, page = 1, limit = 24 } = req.query;

    // Get suspended seller IDs to exclude their products
    const User = require('../models/User');
    const suspendedSellers = await User.find({ userType: 'seller', status: 'suspended' }).select('_id').lean();
    const suspendedIds = suspendedSellers.map(s => s._id);

    const filter = { isActive: true, stock: { $gt: 0 } };
    if (suspendedIds.length > 0) {
      filter.sellerId = { $nin: suspendedIds };
    }

    if (category) filter.category = category;
    if (seller) filter.sellerId = seller;
    if (featured === 'true') filter.isFeatured = true;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (search) {
      filter.$text = { $search: search };
    }

    let sortObj = { createdAt: -1 };
    if (sort === 'price_asc') sortObj = { price: 1 };
    if (sort === 'price_desc') sortObj = { price: -1 };
    if (sort === 'popular') sortObj = { orderCount: -1 };
    if (sort === 'rating') sortObj = { averageRating: -1 };
    if (sort === 'newest') sortObj = { createdAt: -1 };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const products = await Product.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('sellerId', 'name sellerProfile.businessName sellerProfile.businessSlug sellerProfile.avatar sellerProfile.rating sellerProfile.isVerified');
    const total = await Product.countDocuments(filter);

    res.json({ products, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/products/featured
router.get('/featured', async (req, res) => {
  try {
    const User = require('../models/User');
    const suspendedSellers = await User.find({ userType: 'seller', status: 'suspended' }).select('_id').lean();
    const suspendedIds = suspendedSellers.map(s => s._id);

    const featuredFilter = { isFeatured: true, isActive: true, stock: { $gt: 0 } };
    if (suspendedIds.length > 0) featuredFilter.sellerId = { $nin: suspendedIds };

    const products = await Product.find(featuredFilter)
      .limit(12)
      .populate('sellerId', 'name sellerProfile.businessName sellerProfile.businessSlug sellerProfile.avatar sellerProfile.isVerified');
    res.json({ products });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/products/categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ displayOrder: 1 });
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/products/:slug
router.get('/:slug', async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, isActive: true })
      .populate('sellerId', 'name status sellerProfile.businessName sellerProfile.businessSlug sellerProfile.avatar sellerProfile.rating sellerProfile.totalOrders sellerProfile.isVerified');

    if (!product) {
      // Try by ID as fallback
      const byId = await Product.findById(req.params.slug)
        .populate('sellerId', 'name status sellerProfile.businessName sellerProfile.businessSlug sellerProfile.avatar sellerProfile.rating sellerProfile.totalOrders sellerProfile.isVerified');
      if (!byId || byId.sellerId?.status === 'suspended') return res.status(404).json({ message: 'Product not found' });

      byId.viewCount += 1;
      await byId.save();
      return res.json({ product: byId });
    }

    // Hide product if seller is suspended
    if (product.sellerId?.status === 'suspended') {
      return res.status(404).json({ message: 'Product not found' });
    }

    product.viewCount += 1;
    await product.save();
    res.json({ product });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
