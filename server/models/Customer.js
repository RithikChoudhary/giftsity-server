const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
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
    enum: ['active', 'suspended'],
    default: 'active'
  },
  otp: { type: String, default: null },
  otpExpiry: { type: Date, default: null },
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
  legacyUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

customerSchema.index({ status: 1, createdAt: -1 });

customerSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Customer', customerSchema);
