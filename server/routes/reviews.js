const express = require('express');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { uploadImage } = require('../config/cloudinary');
const { sanitizeBody } = require('../middleware/sanitize');
const { validateReviewCreation } = require('../middleware/validators');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');
const { createNotification } = require('../utils/notify');
const router = express.Router();

// GET /api/reviews/product/:productId
router.get('/product/:productId', cacheMiddleware(120), async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.productId)) {
      return res.json({ reviews: [], total: 0, page: 1, pages: 0, ratingBreakdown: {} });
    }
    const { page = 1, limit = 10 } = req.query;
    const productObjId = new mongoose.Types.ObjectId(req.params.productId);
    const filter = { productId: productObjId, isHidden: false };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reviews = await Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('customerId', 'name');
    const total = await Review.countDocuments(filter);

    // Rating breakdown aggregation
    const breakdownAgg = await Review.aggregate([
      { $match: { productId: productObjId, isHidden: false } },
      { $group: { _id: '$rating', count: { $sum: 1 } } }
    ]);
    const ratingBreakdown = {};
    for (let i = 1; i <= 5; i++) ratingBreakdown[i] = 0;
    breakdownAgg.forEach(b => { ratingBreakdown[b._id] = b.count; });

    res.json({ reviews, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), ratingBreakdown });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/reviews
router.post('/', requireAuth, sanitizeBody, validateReviewCreation, async (req, res) => {
  try {
    if ((req.user.userType || req.user.role) !== 'customer') {
      return res.status(403).json({ message: 'Customer access required' });
    }
    const { productId, orderId, rating, reviewText, images } = req.body;

    if (!productId || !orderId || !rating) {
      return res.status(400).json({ message: 'Product, order, and rating are required' });
    }

    // Verify the customer actually has a delivered order for this product
    const order = await Order.findOne({
      _id: orderId,
      customerId: req.user._id,
      status: 'delivered',
      'items.productId': productId
    });
    if (!order) return res.status(400).json({ message: 'You can only review products from delivered orders' });

    // Check if already reviewed
    const existing = await Review.findOne({ productId, customerId: req.user._id, orderId });
    if (existing) return res.status(400).json({ message: 'You have already reviewed this product for this order' });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Upload review images
    const uploadedImages = [];
    if (images && Array.isArray(images)) {
      for (const img of images.slice(0, 3)) { // max 3 images
        if (img.startsWith('data:')) {
          const result = await uploadImage(img, { folder: `giftsity/reviews/${req.user._id}` });
          uploadedImages.push(result);
        }
      }
    }

    const review = new Review({
      productId,
      sellerId: product.sellerId,
      customerId: req.user._id,
      orderId,
      rating: Math.min(5, Math.max(1, Number(rating))),
      reviewText: reviewText || '',
      images: uploadedImages
    });
    await review.save();

    // Update product aggregate ratings
    const agg = await Review.aggregate([
      { $match: { productId: product._id, isHidden: false } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    if (agg[0]) {
      product.averageRating = Math.round(agg[0].avg * 10) / 10;
      product.reviewCount = agg[0].count;
      await product.save();
    }

    // Notify seller about the review
    if (product.sellerId) {
      createNotification({
        userId: product.sellerId.toString(), userRole: 'seller',
        type: 'review_received', title: `New ${rating}-star review`,
        message: `${req.user.name || 'A customer'} reviewed "${product.title}"`,
        link: '/seller/products', metadata: { productId: product._id.toString(), rating }
      });
    }

    // Invalidate cached reviews and product data
    invalidateCache('/api/reviews/product/' + productId);
    invalidateCache('/api/products/' + (await Product.findById(productId).select('slug').lean())?.slug);
    invalidateCache('/api/store/');

    res.status(201).json({ review, message: 'Review submitted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/reviews/:id/hide (admin)
router.put('/:id/hide', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    review.isHidden = !review.isHidden;
    review.hiddenReason = reason || '';
    await review.save();

    // Recalculate product ratings
    const agg = await Review.aggregate([
      { $match: { productId: review.productId, isHidden: false } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    const product = await Product.findById(review.productId);
    if (product) {
      product.averageRating = agg[0] ? Math.round(agg[0].avg * 10) / 10 : 0;
      product.reviewCount = agg[0] ? agg[0].count : 0;
      await product.save();
    }

    // Invalidate cached reviews
    invalidateCache('/api/reviews/product/' + review.productId);
    invalidateCache('/api/store/');

    res.json({ review, message: review.isHidden ? 'Review hidden' : 'Review shown' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
