const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const Customer = require('../models/Customer');
const Seller = require('../models/Seller');
const { sendOTP } = require('../utils/email');
const { requireAuth } = require('../middleware/auth');
const { cloudinary } = require('../config/cloudinary');
const { findIdentityByEmail, signIdentityToken, createAuthSession } = require('../utils/identity');
const { logOtpEvent, logAuthEvent } = require('../utils/audit');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Rate limiter: max 5 OTP requests per email per 15 minutes
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.body?.email?.toLowerCase?.()?.trim() || req.ip,
  message: { message: 'Too many OTP requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter: max 10 OTP verifications per IP per 15 minutes
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many verification attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Generate 6-digit OTP
const generateOTP = () => crypto.randomInt(100000, 999999).toString();

// POST /api/auth/send-otp
router.post('/send-otp', otpLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const normalizedEmail = email.toLowerCase().trim();
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES || '10')) * 60 * 1000);

    // Find in role-specific collections first, then fallback to legacy User
    let identity = await findIdentityByEmail(normalizedEmail);
    if (!identity) {
      const customer = new Customer({ email: normalizedEmail, status: 'active' });
      await customer.save();
      identity = { role: 'customer', source: 'new', entity: customer };
    }

    identity.entity.otp = otp;
    identity.entity.otpExpiry = otpExpiry;
    await identity.entity.save();

    await sendOTP(normalizedEmail, otp);
    await logOtpEvent(req, { email: normalizedEmail, role: identity.role, event: 'sent' });

    res.json({
      message: 'OTP sent to your email',
      isNewUser: identity.role === 'customer' ? !identity.entity.isProfileComplete : false
    });
  } catch (err) {
    console.error('Send OTP error:', err);
    await logOtpEvent(req, { email: req.body?.email || '', event: 'failed', metadata: { stage: 'send' } });
    res.status(500).json({ message: 'Failed to send OTP' });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', verifyLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP required' });

    const normalizedEmail = email.toLowerCase().trim();
    const otpStr = String(otp).trim();
    let identity = await findIdentityByEmail(normalizedEmail);
    if (!identity) return res.status(400).json({ message: 'No account found' });

    const user = identity.entity;
    if (!user.otp || !user.otpExpiry) return res.status(400).json({ message: 'OTP expired or not requested. Please resend OTP.' });
    if (new Date() > user.otpExpiry) {
      await logOtpEvent(req, { email: normalizedEmail, role: identity.role, event: 'expired' });
      return res.status(400).json({ message: 'OTP expired. Request a new one.' });
    }
    if (String(user.otp) !== otpStr) {
      await logOtpEvent(req, { email: normalizedEmail, role: identity.role, event: 'failed', metadata: { reason: 'invalid_otp' } });
      await logAuthEvent(req, { action: 'login_failed', role: identity.role, email: normalizedEmail, reason: 'invalid_otp' });
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    const userType = identity.source === 'legacy' ? user.userType : identity.role;
    if (user.status === 'suspended' && userType !== 'seller') {
      return res.status(403).json({ message: 'Account suspended' });
    }

    const token = signIdentityToken(identity);
    await createAuthSession(token, identity, req);
    await logOtpEvent(req, { email: normalizedEmail, role: identity.role, event: 'verified' });
    await logAuthEvent(req, { action: 'login_success', role: identity.role, userId: user._id, email: normalizedEmail });

    res.json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        userType: userType,
        role: identity.role,
        status: user.status,
        isProfileComplete: user.isProfileComplete !== undefined ? user.isProfileComplete : true,
        sellerProfile: userType === 'seller' ? user.sellerProfile : undefined
      }
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    await logAuthEvent(req, { action: 'login_failed', reason: 'server_error', email: req.body?.email || '' });
    res.status(500).json({ message: 'Verification failed' });
  }
});

// Rate limiter for avatar upload (no auth, so limit by IP)
const avatarUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many upload attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// POST /api/auth/upload-avatar - upload profile photo (no auth needed for registration)
router.post('/upload-avatar', avatarUploadLimiter, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    // Use user-specific folder if authenticated, else generic
    const userId = req.user?._id || 'anonymous';
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `giftsity/avatars/${userId}`, transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }] },
        (err, result) => err ? reject(err) : resolve(result)
      );
      stream.end(req.file.buffer);
    });

    res.json({ url: result.secure_url, publicId: result.public_id });
  } catch (err) {
    console.error('Upload avatar error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
});

// POST /api/auth/register-seller
router.post('/register-seller', async (req, res) => {
  try {
    const { email, name, phone, instagramUsername, avatarUrl, avatarPublicId, referralCode } = req.body;

    if (!email || !name || !phone) {
      return res.status(400).json({ message: 'Email, name, and phone are required' });
    }
    if (!instagramUsername) {
      return res.status(400).json({ message: 'Instagram username is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let seller = await Seller.findOne({ email: normalizedEmail });
    if (seller) {
      return res.status(400).json({ message: 'Seller account already exists for this email' });
    }

    let referredBySeller = null;
    if (referralCode) {
      referredBySeller = await Seller.findOne({ 'sellerProfile.referralCode': referralCode.toUpperCase() });
    }

    const sellerRefCode = (name.replace(/\s/g, '').substring(0, 4).toUpperCase() + Date.now().toString(36).toUpperCase()).substring(0, 10);
    const businessSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20) + Math.random().toString(36).substring(2, 6);

    seller = new Seller({
      email: normalizedEmail,
      name,
      phone,
      status: 'pending',
      isProfileComplete: true,
      sellerProfile: {
        businessName: name,
        businessSlug,
        bio: '',
        avatar: { url: avatarUrl || '', publicId: avatarPublicId || '' },
        coverImage: { url: '', publicId: '' },
        businessType: '',
        gstNumber: '',
        isVerified: false,
        deliveredOrders: 0,
        failedOrders: 0,
        businessAddress: { street: '', city: '', state: '', pincode: '' },
        pickupAddress: { street: '', city: '', state: '', pincode: '', phone: '' },
        bankDetails: { accountHolderName: '', accountNumber: '', ifscCode: '', bankName: '' },
        commissionRate: null,
        totalSales: 0,
        totalOrders: 0,
        rating: 0,
        approvedAt: null,
        approvedBy: null,
        referralCode: sellerRefCode,
        referredBy: referredBySeller?._id || null,
        referralCount: 0,
        instagramUsername: instagramUsername.replace('@', '').trim(),
        suspensionRemovalRequested: false,
        suspensionRemovalReason: ''
      }
    });
    await seller.save();

    if (referredBySeller) {
      referredBySeller.sellerProfile.referralCount = (referredBySeller.sellerProfile.referralCount || 0) + 1;
      await referredBySeller.save();
    }

    const otp = generateOTP();
    seller.otp = otp;
    seller.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await seller.save();
    await sendOTP(normalizedEmail, otp);
    await logOtpEvent(req, { email: normalizedEmail, role: 'seller', event: 'sent', metadata: { stage: 'register_seller' } });

    res.status(201).json({
      message: 'Application submitted! Check your email for the login code. Admin will review your profile.',
      sellerId: seller._id
    });
  } catch (err) {
    console.error('Register seller error:', err);
    res.status(500).json({ message: 'Registration failed' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const user = req.user;
  const userType = user.userType || user.role;
  res.json({
    user: {
      _id: user._id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      userType,
      status: user.status,
      isProfileComplete: user.isProfileComplete !== undefined ? user.isProfileComplete : true,
      shippingAddresses: user.shippingAddresses || [],
      sellerProfile: userType === 'seller' ? user.sellerProfile : undefined
    }
  });
});

// PUT /api/auth/profile
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = req.user;

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (name && phone && user.isProfileComplete !== undefined) user.isProfileComplete = true;
    await user.save();

    res.json({ message: 'Profile updated', user: { _id: user._id, email: user.email, name: user.name, phone: user.phone, userType: user.userType || user.role, isProfileComplete: user.isProfileComplete !== undefined ? user.isProfileComplete : true } });
  } catch (err) {
    res.status(500).json({ message: 'Update failed' });
  }
});

// PUT /api/auth/addresses
router.put('/addresses', requireAuth, async (req, res) => {
  try {
    if ((req.user.userType || req.user.role) !== 'customer') {
      return res.status(403).json({ message: 'Addresses can only be updated for customer accounts' });
    }
    const { addresses } = req.body;
    req.user.shippingAddresses = addresses;
    await req.user.save();
    res.json({ message: 'Addresses updated', addresses: req.user.shippingAddresses });
  } catch (err) {
    res.status(500).json({ message: 'Update failed' });
  }
});

module.exports = router;
