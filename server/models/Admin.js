const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
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
  role: { type: String, default: 'admin' },
  legacyUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

adminSchema.index({ email: 1 }, { unique: true });
adminSchema.index({ status: 1, createdAt: -1 });

adminSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Admin', adminSchema);
