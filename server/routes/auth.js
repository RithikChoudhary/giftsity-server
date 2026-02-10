const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const User = require('../models/User');
const { sendOTP } = require('../utils/email');
const { requireAuth } = require('../middleware/auth');
const { cloudinary } = require('../config/cloudinary');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Generate 6-digit OTP
const generateOTP = () => crypto.randomInt(100000, 999999).toString();

// POST /api/auth/send-otp
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const normalizedEmail = email.toLowerCase().trim();
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES || '10')) * 60 * 1000);

    // Find or create user
    let user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      user = new User({ email: normalizedEmail, userType: 'customer' });
    }

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    await sendOTP(normalizedEmail, otp);

    res.json({ message: 'OTP sent to your email', isNewUser: !user.isProfileComplete });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP required' });

    const normalizedEmail = email.toLowerCase().trim();
    const otpStr = String(otp).trim();

    // Atomic: find user with matching OTP, clear it in one step (prevents race conditions from double-submit)
    const user = await User.findOneAndUpdate(
      {
        email: normalizedEmail,
        otp: otpStr,
        otpExpiry: { $gt: new Date() }
      },
      { $set: { otp: null, otpExpiry: null } },
      { new: true }
    );

    if (!user) {
      // Provide specific error message
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (!existingUser) return res.status(400).json({ message: 'No account found' });
      if (!existingUser.otp || !existingUser.otpExpiry) return res.status(400).json({ message: 'OTP expired or not requested. Please resend OTP.' });
      if (new Date() > existingUser.otpExpiry) return res.status(400).json({ message: 'OTP expired. Request a new one.' });
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // Suspended sellers CAN log in to request removal - but show suspended status
    // Only fully blocked for non-sellers
    if (user.status === 'suspended' && user.userType !== 'seller') {
      return res.status(403).json({ message: 'Account suspended' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        userType: user.userType,
        status: user.status,
        isProfileComplete: user.isProfileComplete,
        sellerProfile: user.userType === 'seller' ? user.sellerProfile : undefined
      }
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ message: 'Verification failed' });
  }
});

// POST /api/auth/upload-avatar - upload profile photo (no auth needed for registration)
router.post('/upload-avatar', upload.single('avatar'), async (req, res) => {
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
    let user = await User.findOne({ email: normalizedEmail });

    if (user && user.userType === 'seller') {
      return res.status(400).json({ message: 'Seller account already exists for this email' });
    }

    // Handle referral
    let referredByUser = null;
    if (referralCode) {
      referredByUser = await User.findOne({ 'sellerProfile.referralCode': referralCode.toUpperCase(), userType: 'seller' });
    }

    // Generate unique referral code from name
    const sellerRefCode = (name.replace(/\s/g, '').substring(0, 4).toUpperCase() + Date.now().toString(36).toUpperCase()).substring(0, 10);

    // Generate business slug from name
    const businessSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20) + Math.random().toString(36).substring(2, 6);

    if (user) {
      user.userType = 'seller';
      user.status = 'pending';
      user.name = name;
      user.phone = phone;
    } else {
      user = new User({
        email: normalizedEmail,
        name,
        phone,
        userType: 'seller',
        status: 'pending'
      });
    }

    // Merge carefully to avoid overwriting sub-documents with undefined
    const existingProfile = user.sellerProfile ? (user.sellerProfile.toObject ? user.sellerProfile.toObject() : user.sellerProfile) : {};
    user.sellerProfile = {
      businessName: existingProfile.businessName || name,
      businessSlug: businessSlug,
      bio: existingProfile.bio || '',
      avatar: { url: avatarUrl || '', publicId: avatarPublicId || '' },
      coverImage: existingProfile.coverImage || { url: '', publicId: '' },
      businessType: existingProfile.businessType || '',
      gstNumber: existingProfile.gstNumber || '',
      isVerified: false,
      deliveredOrders: existingProfile.deliveredOrders || 0,
      failedOrders: existingProfile.failedOrders || 0,
      businessAddress: existingProfile.businessAddress || { street: '', city: '', state: '', pincode: '' },
      pickupAddress: existingProfile.pickupAddress || { street: '', city: '', state: '', pincode: '', phone: '' },
      bankDetails: existingProfile.bankDetails || { accountHolderName: '', accountNumber: '', ifscCode: '', bankName: '' },
      commissionRate: null,
      totalSales: existingProfile.totalSales || 0,
      totalOrders: existingProfile.totalOrders || 0,
      rating: existingProfile.rating || 0,
      approvedAt: null,
      approvedBy: null,
      referralCode: sellerRefCode,
      referredBy: referredByUser?._id || null,
      referralCount: existingProfile.referralCount || 0,
      instagramUsername: instagramUsername.replace('@', '').trim(),
      suspensionRemovalRequested: false,
      suspensionRemovalReason: ''
    };
    user.isProfileComplete = true;
    await user.save();

    if (referredByUser) {
      referredByUser.sellerProfile.referralCount = (referredByUser.sellerProfile.referralCount || 0) + 1;
      const rc = referredByUser.sellerProfile.referralCount;
      // Referral rewards
      if (rc >= 10) {
        // Lock 0% commission for 1 year
        referredByUser.sellerProfile.commissionRate = 0;
        referredByUser.sellerProfile.commissionLockedUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      }
      await referredByUser.save();
    }

    // Send OTP
    const otp = generateOTP();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    await sendOTP(normalizedEmail, otp);

    res.status(201).json({
      message: 'Application submitted! Check your email for the login code. Admin will review your profile.',
      sellerId: user._id
    });
  } catch (err) {
    console.error('Register seller error:', err);
    res.status(500).json({ message: 'Registration failed' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const user = req.user;
  res.json({
    user: {
      _id: user._id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      userType: user.userType,
      status: user.status,
      isProfileComplete: user.isProfileComplete,
      shippingAddresses: user.shippingAddresses,
      sellerProfile: user.userType === 'seller' ? user.sellerProfile : undefined
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
    if (name && phone) user.isProfileComplete = true;
    await user.save();

    res.json({ message: 'Profile updated', user: { _id: user._id, email: user.email, name: user.name, phone: user.phone, userType: user.userType, isProfileComplete: user.isProfileComplete } });
  } catch (err) {
    res.status(500).json({ message: 'Update failed' });
  }
});

// PUT /api/auth/addresses
router.put('/addresses', requireAuth, async (req, res) => {
  try {
    const { addresses } = req.body;
    req.user.shippingAddresses = addresses;
    await req.user.save();
    res.json({ message: 'Addresses updated', addresses: req.user.shippingAddresses });
  } catch (err) {
    res.status(500).json({ message: 'Update failed' });
  }
});

module.exports = router;
