const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, default: '' },
  phone: { type: String, default: '' },
  userType: {
    type: String,
    enum: ['admin', 'seller', 'customer'],
    default: 'customer'
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'suspended'],
    default: 'active'
  },

  // OTP auth (no passwords)
  otp: { type: String, default: null },
  otpExpiry: { type: Date, default: null },

  // Seller-specific fields
  sellerProfile: {
    businessName: { type: String, default: '' },
    businessSlug: { type: String, default: '' },
    bio: { type: String, default: '' },
    avatar: { url: { type: String, default: '' }, publicId: { type: String, default: '' } },
    coverImage: { url: { type: String, default: '' }, publicId: { type: String, default: '' } },
    businessType: {
      type: String,
      enum: ['individual', 'proprietorship', 'partnership', 'pvt_ltd', ''],
      default: ''
    },
    gstNumber: { type: String, default: '' },
    isVerified: { type: Boolean, default: false },
    deliveredOrders: { type: Number, default: 0 },
    failedOrders: { type: Number, default: 0 },
    businessAddress: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' }
    },
    pickupAddress: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
      phone: { type: String, default: '' }
    },
    bankDetails: {
      accountHolderName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      ifscCode: { type: String, default: '' },
      bankName: { type: String, default: '' }
    },
    commissionRate: { type: Number, default: null }, // null = use global rate
    totalSales: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    referralCode: { type: String, default: '' },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    referralCount: { type: Number, default: 0 },
    instagramUsername: { type: String, default: '' },
    suspensionRemovalRequested: { type: Boolean, default: false },
    suspensionRemovalReason: { type: String, default: '' },

    // Seller Health Metrics (calculated by cron)
    metrics: {
      fulfillmentRate: { type: Number, default: 100 },    // % of orders shipped on time
      cancelRate: { type: Number, default: 0 },            // % of seller-cancelled orders
      lateShipmentRate: { type: Number, default: 0 },      // % of orders shipped late (>48h)
      avgShipTimeHours: { type: Number, default: 0 },      // avg hours to ship
      healthScore: { type: Number, default: 100 },         // composite 0-100
      warningCount: { type: Number, default: 0 },
      lastCalculatedAt: { type: Date, default: null }
    },
    lastActiveAt: { type: Date, default: Date.now },
    suspensionType: { type: String, enum: ['manual', 'auto', ''], default: '' },
    suspensionReason: { type: String, default: '' }
  },

  // Customer-specific fields
  shippingAddresses: [{
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
    isDefault: { type: Boolean, default: false }
  }],

  isProfileComplete: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// email uniqueness handled by schema `unique: true`
userSchema.index({ userType: 1, status: 1 });
userSchema.index({ 'sellerProfile.businessName': 'text' });
userSchema.index({ 'sellerProfile.businessSlug': 1 });
userSchema.index({ 'sellerProfile.referralCode': 1 });

userSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);
