const express = require('express');
const Coupon = require('../models/Coupon');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// POST /api/coupons/apply -- validate and return discount
router.post('/apply', requireAuth, async (req, res) => {
  try {
    if ((req.user.userType || req.user.role) !== 'customer') {
      return res.status(403).json({ message: 'Customer access required' });
    }
    const { code, orderTotal } = req.body;
    if (!code) return res.status(400).json({ message: 'Coupon code required' });

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
    if (!coupon) return res.status(404).json({ message: 'Invalid coupon code' });
    if (coupon.expiresAt < new Date()) return res.status(400).json({ message: 'Coupon has expired' });
    if (coupon.usedCount >= coupon.usageLimit) return res.status(400).json({ message: 'Coupon usage limit reached' });
    if (coupon.usedBy && coupon.usedBy.includes(req.user._id.toString())) {
      return res.status(400).json({ message: 'You have already used this coupon' });
    }
    if (orderTotal && orderTotal < coupon.minOrderAmount) {
      return res.status(400).json({ message: `Minimum order of Rs. ${coupon.minOrderAmount} required` });
    }

    let discount = 0;
    if (coupon.type === 'percent') {
      discount = (orderTotal * coupon.value) / 100;
      if (coupon.maxDiscount > 0) discount = Math.min(discount, coupon.maxDiscount);
    } else {
      discount = coupon.value;
    }
    discount = Math.min(discount, orderTotal || 999999);

    res.json({
      valid: true,
      code: coupon.code,
      description: coupon.description,
      type: coupon.type,
      value: coupon.value,
      discount: Math.round(discount),
      maxDiscount: coupon.maxDiscount
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// =================== ADMIN COUPON CRUD ===================

// GET /api/coupons -- admin list
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json({ coupons });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/coupons -- admin create
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { code, description, type, value, minOrderAmount, maxDiscount, usageLimit, expiresAt } = req.body;
    if (!code || !value || !expiresAt) return res.status(400).json({ message: 'Code, value, and expiry required' });

    const existing = await Coupon.findOne({ code: code.toUpperCase() });
    if (existing) return res.status(400).json({ message: 'Coupon code already exists' });

    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      description: description || '',
      type: type || 'percent',
      value,
      minOrderAmount: minOrderAmount || 0,
      maxDiscount: maxDiscount || 0,
      usageLimit: usageLimit || 100,
      expiresAt
    });
    res.status(201).json({ coupon, message: 'Coupon created' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/coupons/:id -- admin update
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Whitelist allowed fields to prevent mass assignment
    const { code, description, type, value, minOrderAmount, maxDiscount, usageLimit, expiresAt, isActive } = req.body;
    const update = {};
    if (code !== undefined) update.code = typeof code === 'string' ? code.toUpperCase() : code;
    if (description !== undefined) update.description = description;
    if (type !== undefined) update.type = type;
    if (value !== undefined) update.value = value;
    if (minOrderAmount !== undefined) update.minOrderAmount = minOrderAmount;
    if (maxDiscount !== undefined) update.maxDiscount = maxDiscount;
    if (usageLimit !== undefined) update.usageLimit = usageLimit;
    if (expiresAt !== undefined) update.expiresAt = expiresAt;
    if (isActive !== undefined) update.isActive = isActive;

    const coupon = await Coupon.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
    res.json({ coupon, message: 'Coupon updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/coupons/:id -- admin delete
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ message: 'Coupon deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
