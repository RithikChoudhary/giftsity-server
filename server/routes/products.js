const express = require('express');
const multer = require('multer');
const Product = require('../models/Product');
const Category = require('../models/Category');
const { requireAuth } = require('../middleware/auth');
const { uploadImage } = require('../config/cloudinary');
const { cacheMiddleware } = require('../middleware/cache');
const logger = require('../utils/logger');
const Seller = require('../models/Seller');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB per customization image

// Cache suspended seller IDs (60s TTL) to avoid querying on every product listing
let _suspendedCache = { ids: [], ts: 0 };
async function getSuspendedSellerIds() {
  if (Date.now() - _suspendedCache.ts < 60000) return _suspendedCache.ids;
  const sellers = await Seller.find({ status: 'suspended' }).select('_id').lean();
  _suspendedCache = { ids: sellers.map(s => s._id), ts: Date.now() };
  return _suspendedCache.ids;
}

// Allowed image MIME types for customization uploads
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// POST /api/products/upload-customization - upload customization image
router.post('/upload-customization', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image file provided' });
    if (!ALLOWED_IMAGE_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ message: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' });
    }

    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const result = await uploadImage(base64, {
      folder: `giftsity/customizations/${req.user._id}`,
      transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }]
    });

    res.json({ url: result.url, publicId: result.publicId });
  } catch (err) {
    logger.error('[Customization Upload]', err.message);
    res.status(500).json({ message: 'Image upload failed' });
  }
});

// GET /api/products - public product listing
router.get('/', cacheMiddleware(60), async (req, res) => {
  try {
    const { category, minPrice, maxPrice, seller, search, featured, sort, page = 1, limit = 24 } = req.query;

    const suspendedIds = await getSuspendedSellerIds();

    const filter = { isActive: true, stock: { $gt: 0 } };
    if (suspendedIds.length > 0) {
      filter.sellerId = { $nin: suspendedIds };
    }

    if (category && typeof category === 'string') filter.category = category;
    if (seller && typeof seller === 'string' && /^[a-f0-9]{24}$/i.test(seller)) filter.sellerId = seller;
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
router.get('/featured', cacheMiddleware(60), async (req, res) => {
  try {
    const suspendedIds = await getSuspendedSellerIds();

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
router.get('/categories', cacheMiddleware(300), async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ displayOrder: 1 });
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/products/:slug
router.get('/:slug', cacheMiddleware(120), async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, isActive: true })
      .populate('sellerId', 'name status sellerProfile.businessName sellerProfile.businessSlug sellerProfile.avatar sellerProfile.rating sellerProfile.totalOrders sellerProfile.isVerified');

    if (!product) {
      // Try by ID as fallback
      const byId = await Product.findById(req.params.slug)
        .populate('sellerId', 'name status sellerProfile.businessName sellerProfile.businessSlug sellerProfile.avatar sellerProfile.rating sellerProfile.totalOrders sellerProfile.isVerified');
      if (!byId || byId.sellerId?.status === 'suspended') return res.status(404).json({ message: 'Product not found' });

      Product.findByIdAndUpdate(byId._id, { $inc: { viewCount: 1 } }).catch(() => {});
      return res.json({ product: byId });
    }

    // Hide product if seller is suspended
    if (product.sellerId?.status === 'suspended') {
      return res.status(404).json({ message: 'Product not found' });
    }

    Product.findByIdAndUpdate(product._id, { $inc: { viewCount: 1 } }).catch(() => {});
    res.json({ product });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
