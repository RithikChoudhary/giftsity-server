const express = require('express');
const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const { requireAuth } = require('../middleware/auth');
const logger = require('../utils/logger');
const router = express.Router();

const requireCustomer = (req, res, next) => {
  if ((req.user.userType || req.user.role) !== 'customer') {
    return res.status(403).json({ message: 'Customer access required' });
  }
  next();
};

router.use(requireAuth, requireCustomer);

// GET /api/wishlist -- get user's wishlist
router.get('/', async (req, res) => {
  try {
    const items = await Wishlist.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate({
        path: 'productId',
        select: 'title slug price images averageRating reviewCount stock sellerId isActive',
        populate: { path: 'sellerId', select: 'sellerProfile.businessName sellerProfile.businessSlug sellerProfile.avatar' }
      });
    // Filter out deleted/inactive products
    const valid = items.filter(i => i.productId && i.productId.isActive);
    res.json({ items: valid.map(i => ({ _id: i._id, product: i.productId, addedAt: i.createdAt })) });
  } catch (err) {
    logger.error('[Wishlist] Get wishlist error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/wishlist/ids -- get just product IDs (for quick checking)
router.get('/ids', async (req, res) => {
  try {
    const items = await Wishlist.find({ userId: req.user._id }).select('productId');
    res.json({ productIds: items.map(i => i.productId.toString()) });
  } catch (err) {
    logger.error('[Wishlist] Get IDs error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/wishlist -- add to wishlist
router.post('/', async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ message: 'Product ID required' });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const existing = await Wishlist.findOne({ userId: req.user._id, productId });
    if (existing) return res.json({ message: 'Already in wishlist' });

    await Wishlist.create({ userId: req.user._id, productId });
    res.status(201).json({ message: 'Added to wishlist' });
  } catch (err) {
    logger.error('[Wishlist] Add error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/wishlist/:productId -- remove from wishlist
router.delete('/:productId', async (req, res) => {
  try {
    await Wishlist.deleteOne({ userId: req.user._id, productId: req.params.productId });
    res.json({ message: 'Removed from wishlist' });
  } catch (err) {
    logger.error('[Wishlist] Remove error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
