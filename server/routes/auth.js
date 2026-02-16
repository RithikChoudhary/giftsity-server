const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const Customer = require('../models/Customer');
const Seller = require('../models/Seller');
const { sendOTP } = require('../utils/email');
const { requireAuth } = require('../middleware/auth');
const { cloudinary } = require('../config/cloudinary');
const { findIdentityByEmail, findAllRolesForEmail, findIdentityByEmailAndRole, signIdentityToken, createAuthSession } = require('../utils/identity');
const { sanitizeBody } = require('../middleware/sanitize');
const { logOtpEvent, logAuthEvent } = require('../utils/audit');
const logger = require('../utils/logger');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Rate limiter: max 5 OTP requests per email per 15 minutes
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.body?.email?.toLowerCase?.()?.trim() || 'unknown',
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
    logger.error('[send-otp] Failed', { message: err.message, stack: err.stack, email: req.body?.email });
    await logOtpEvent(req, { email: req.body?.email || '', event: 'failed', metadata: { stage: 'send', error: err.message } });
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
    logger.error('Verify OTP error:', err);
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

    // Validate MIME type to prevent non-image uploads
    const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_AVATAR_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ message: 'Invalid file type. Only JPEG, PNG, WebP, and GIF allowed.' });
    }

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
    logger.error('Upload avatar error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
});

// POST /api/auth/register-seller
router.post('/register-seller', async (req, res) => {
  try {
    const { email, name, phone, instagramUsername, avatarUrl, avatarPublicId, referralCode, coverImageUrl, coverImagePublicId, businessName, businessType, gstNumber } = req.body;

    if (!email || !name || !phone) {
      return res.status(400).json({ message: 'Email, name, and phone are required' });
    }
    if (!instagramUsername) {
      return res.status(400).json({ message: 'Instagram username is required' });
    }

    // Verify Instagram username exists
    const cleanIg = instagramUsername.replace('@', '').trim();
    try {
      const { verifyInstagramUsername } = require('../utils/instagram');
      const igResult = await verifyInstagramUsername(cleanIg);
      if (!igResult.exists) {
        return res.status(400).json({ message: `Instagram account @${cleanIg} not found. Please enter a valid username.` });
      }
    } catch (igErr) {
      logger.warn('[Instagram] Verification failed during registration, allowing:', igErr.message);
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
        businessName: businessName || name,
        businessSlug,
        bio: '',
        avatar: { url: avatarUrl || '', publicId: avatarPublicId || '' },
        coverImage: { url: coverImageUrl || '', publicId: coverImagePublicId || '' },
        businessType: businessType || '',
        gstNumber: gstNumber || '',
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
        instagramUsername: cleanIg,
        instagramVerified: true,
        shiprocketPickupLocation: '',
        suspensionRemovalRequested: false,
        suspensionRemovalReason: ''
      }
    });
    await seller.save();

    if (referredBySeller) {
      await Seller.findByIdAndUpdate(referredBySeller._id, {
        $inc: { 'sellerProfile.referralCount': 1 }
      });
    }

    const otp = generateOTP();
    seller.otp = otp;
    seller.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await seller.save();

    // OTP send is non-fatal: seller is already created, they can resend OTP via login
    let otpSent = false;
    try {
      await sendOTP(normalizedEmail, otp);
      otpSent = true;
      await logOtpEvent(req, { email: normalizedEmail, role: 'seller', event: 'sent', metadata: { stage: 'register_seller' } });
    } catch (otpErr) {
      logger.error('[register-seller] OTP email failed (seller still created)', { message: otpErr.message, email: normalizedEmail });
      await logOtpEvent(req, { email: normalizedEmail, role: 'seller', event: 'failed', metadata: { stage: 'register_seller', error: otpErr.message } });
    }

    res.status(201).json({
      message: otpSent
        ? 'Application submitted! Check your email for the login code. Admin will review your profile.'
        : 'Application submitted! Could not send login code — please try logging in to resend OTP.',
      sellerId: seller._id
    });
  } catch (err) {
    logger.error('[register-seller] Failed', { message: err.message, stack: err.stack });
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
router.put('/profile', requireAuth, sanitizeBody, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = req.user;

    // Validate name
    if (name !== undefined) {
      const trimmed = (name || '').trim();
      if (!trimmed || trimmed.length < 2) {
        return res.status(400).json({ message: 'Name must be at least 2 characters' });
      }
      if (trimmed.length > 50) {
        return res.status(400).json({ message: 'Name cannot exceed 50 characters' });
      }
      if (!/^[a-zA-Z\s'.()-]+$/.test(trimmed)) {
        return res.status(400).json({ message: 'Name can only contain letters, spaces, and basic punctuation' });
      }
      user.name = trimmed;
    }

    // Validate phone
    if (phone !== undefined) {
      const digits = (phone || '').replace(/\D/g, '');
      if (!digits || digits.length !== 10) {
        return res.status(400).json({ message: 'Phone must be exactly 10 digits' });
      }
      user.phone = digits;
    }

    if (user.name && user.phone && user.isProfileComplete !== undefined) user.isProfileComplete = true;
    await user.save();

    res.json({ message: 'Profile updated', user: { _id: user._id, email: user.email, name: user.name, phone: user.phone, userType: user.userType || user.role, isProfileComplete: user.isProfileComplete !== undefined ? user.isProfileComplete : true } });
  } catch (err) {
    res.status(500).json({ message: 'Update failed' });
  }
});

// PUT /api/auth/addresses
router.put('/addresses', requireAuth, sanitizeBody, async (req, res) => {
  try {
    if ((req.user.userType || req.user.role) !== 'customer') {
      return res.status(403).json({ message: 'Addresses can only be updated for customer accounts' });
    }
    const { addresses } = req.body;
    // Sanitize _id fields: keep valid ObjectIds (existing), strip invalid ones (new)
    const mongoose = require('mongoose');
    const sanitized = (addresses || []).map(addr => {
      const { _id, ...rest } = addr;
      if (_id && mongoose.Types.ObjectId.isValid(_id)) {
        return { _id, ...rest };
      }
      return rest; // Let Mongoose auto-generate _id for new addresses
    });
    req.user.shippingAddresses = sanitized;
    await req.user.save();
    res.json({ message: 'Addresses updated', addresses: req.user.shippingAddresses });
  } catch (err) {
    res.status(500).json({ message: 'Update failed' });
  }
});

// GET /api/auth/verify-instagram/:username - public Instagram username verification
router.get('/verify-instagram/:username', async (req, res) => {
  try {
    const { verifyInstagramUsername } = require('../utils/instagram');
    const result = await verifyInstagramUsername(req.params.username);
    res.json(result);
  } catch (err) {
    res.status(500).json({ exists: false, error: 'Verification failed' });
  }
});

// GET /api/auth/available-roles
router.get('/available-roles', requireAuth, async (req, res) => {
  try {
    const email = req.user.email;
    const roles = await findAllRolesForEmail(email);
    const currentRole = req.user.role || req.user.userType || 'customer';
    res.json({ roles, currentRole });
  } catch (err) {
    logger.error('Available roles error:', err);
    res.status(500).json({ message: 'Failed to fetch roles' });
  }
});

// POST /api/auth/switch-role
router.post('/switch-role', requireAuth, async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ message: 'Role is required' });

    const allowedRoles = ['customer', 'seller', 'admin'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const email = req.user.email;

    // Verify the target role exists for this email
    const roles = await findAllRolesForEmail(email);
    if (!roles.includes(role)) {
      return res.status(403).json({ message: 'You do not have access to this role' });
    }

    // Find the target identity
    const identity = await findIdentityByEmailAndRole(email, role);
    if (!identity) {
      return res.status(404).json({ message: 'Target role account not found' });
    }

    // Sign new token and create session
    const token = signIdentityToken(identity);
    await createAuthSession(token, identity, req);

    const user = identity.entity;
    const userType = identity.role;

    res.json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        userType,
        role: identity.role,
        status: user.status,
        isProfileComplete: user.isProfileComplete !== undefined ? user.isProfileComplete : true,
        shippingAddresses: user.shippingAddresses || [],
        sellerProfile: userType === 'seller' ? user.sellerProfile : undefined
      }
    });
  } catch (err) {
    logger.error('Switch role error:', err);
    res.status(500).json({ message: 'Role switch failed' });
  }
});

module.exports = router;
