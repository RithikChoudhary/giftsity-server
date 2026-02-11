const mongoose = require('mongoose');

const sellerSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
  },
  name: { type: String, default: '' },
  phone: {
    type: String,
    default: '',
    validate: {
      validator: function (v) { return !v || /^[0-9]{10}$/.test(v); },
      message: 'Phone must be 10 digits'
    }
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'suspended'],
    default: 'pending'
  },
  otp: { type: String, default: null },
  otpExpiry: { type: Date, default: null },
  sellerProfile: {
    businessName: { type: String, default: '' },
    businessSlug: { type: String, default: '' },
    bio: { type: String, default: '' },
    avatar: { url: { type: String, default: '' }, publicId: { type: String, default: '' } },
    coverImage: { url: { type: String, default: '' }, publicId: { type: String, default: '' } },
    businessType: { type: String, enum: ['individual', 'proprietorship', 'partnership', 'pvt_ltd', ''], default: '' },
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
    commissionRate: { type: Number, default: null },
    totalSales: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    referralCode: { type: String, default: '' },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', default: null },
    referralCount: { type: Number, default: 0 },
    instagramUsername: { type: String, default: '' },
    suspensionRemovalRequested: { type: Boolean, default: false },
    suspensionRemovalReason: { type: String, default: '' },
    metrics: {
      fulfillmentRate: { type: Number, default: 100 },
      cancelRate: { type: Number, default: 0 },
      lateShipmentRate: { type: Number, default: 0 },
      avgShipTimeHours: { type: Number, default: 0 },
      healthScore: { type: Number, default: 100 },
      warningCount: { type: Number, default: 0 },
      lastCalculatedAt: { type: Date, default: null }
    },
    lastActiveAt: { type: Date, default: Date.now },
    suspensionType: { type: String, enum: ['manual', 'auto', ''], default: '' },
    suspensionReason: { type: String, default: '' }
  },
  isProfileComplete: { type: Boolean, default: true },
  legacyUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

sellerSchema.index({ status: 1, createdAt: -1 });
sellerSchema.index({ 'sellerProfile.businessName': 'text' });
sellerSchema.index({ 'sellerProfile.businessSlug': 1 }, { unique: true, sparse: true, partialFilterExpression: { 'sellerProfile.businessSlug': { $gt: '' } } });
sellerSchema.index({ 'sellerProfile.referralCode': 1 });

sellerSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Seller', sellerSchema);
