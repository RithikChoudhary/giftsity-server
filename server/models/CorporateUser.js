const mongoose = require('mongoose');

const corporateUserSchema = new mongoose.Schema({
  companyName: { type: String, required: true },
  contactPerson: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, default: '' },
  designation: { type: String, default: '' },
  companySize: {
    type: String,
    enum: ['1-50', '51-200', '201-1000', '1000+', ''],
    default: ''
  },
  gstNumber: { type: String, default: '' },

  billingAddress: {
    name: { type: String, default: '' },
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
    phone: { type: String, default: '' }
  },

  shippingAddresses: [{
    label: { type: String, default: 'Office' },
    name: { type: String, default: '' },
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
    phone: { type: String, default: '' },
    isDefault: { type: Boolean, default: false }
  }],

  status: {
    type: String,
    enum: ['pending_approval', 'active', 'suspended'],
    default: 'pending_approval'
  },

  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  approvedAt: { type: Date, default: null },
  notes: { type: String, default: '' },

  // OTP fields for authentication
  otp: { type: String, default: null },
  otpExpiry: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// email uniqueness handled by schema `unique: true`
corporateUserSchema.index({ status: 1, createdAt: -1 });
corporateUserSchema.index({ companyName: 'text', contactPerson: 'text' });

corporateUserSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('CorporateUser', corporateUserSchema);
