const mongoose = require('mongoose');

const otpLogSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  role: { type: String, enum: ['customer', 'seller', 'admin', 'corporate', 'unknown'], default: 'unknown' },
  event: { type: String, enum: ['sent', 'verified', 'failed', 'expired', 'rate_limited'], required: true },
  ipAddress: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

otpLogSchema.index({ email: 1, createdAt: -1 });
otpLogSchema.index({ role: 1, event: 1, createdAt: -1 });
otpLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.model('OtpLog', otpLogSchema);
