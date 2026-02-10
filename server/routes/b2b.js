const express = require('express');
const B2BInquiry = require('../models/B2BInquiry');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendB2BInquiryNotification } = require('../utils/email');
const router = express.Router();

// POST /api/b2b/inquiries - public (no auth required)
router.post('/inquiries', async (req, res) => {
  try {
    const { companyName, contactPerson, email, phone, numberOfEmployees, budgetPerGift, quantityNeeded, occasion, specialRequirements } = req.body;

    if (!companyName || !contactPerson || !email || !phone) {
      return res.status(400).json({ message: 'Company name, contact person, email, and phone are required' });
    }

    const inquiry = new B2BInquiry({
      companyName,
      contactPerson,
      email,
      phone,
      numberOfEmployees,
      budgetPerGift,
      quantityNeeded,
      occasion,
      specialRequirements,
      activityLog: [{ action: 'Inquiry submitted', timestamp: new Date() }]
    });

    await inquiry.save();

    // Notify admin via email (non-blocking)
    try { await sendB2BInquiryNotification(inquiry); } catch (e) { console.error('B2B notification email failed:', e.message); }

    res.status(201).json({ message: 'Thank you! We\'ll get back to you within 24 hours.', inquiry: { _id: inquiry._id } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to submit inquiry' });
  }
});

// ---- Admin routes ----
router.get('/inquiries', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const inquiries = await B2BInquiry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
    const total = await B2BInquiry.countDocuments(filter);

    res.json({ inquiries, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/inquiries/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const inquiry = await B2BInquiry.findById(req.params.id);
    if (!inquiry) return res.status(404).json({ message: 'Inquiry not found' });
    res.json({ inquiry });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/inquiries/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, adminNotes, quotedAmount } = req.body;
    const inquiry = await B2BInquiry.findById(req.params.id);
    if (!inquiry) return res.status(404).json({ message: 'Inquiry not found' });

    const oldStatus = inquiry.status;
    if (status) inquiry.status = status;
    if (adminNotes !== undefined) inquiry.adminNotes = adminNotes;
    if (quotedAmount !== undefined) inquiry.quotedAmount = quotedAmount;

    if (status === 'converted') inquiry.convertedAt = new Date();

    if (status && status !== oldStatus) {
      inquiry.activityLog.push({
        action: `Status changed from ${oldStatus} to ${status}`,
        timestamp: new Date(),
        by: req.user._id
      });
    }

    await inquiry.save();
    res.json({ inquiry, message: 'Inquiry updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/inquiries/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await B2BInquiry.findByIdAndDelete(req.params.id);
    res.json({ message: 'Inquiry deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
