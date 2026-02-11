const mongoose = require('mongoose');

const authAuditLogSchema = new mongoose.Schema({
  action: { type: String, enum: ['login_success', 'login_failed', 'logout', 'token_rejected', 'session_revoked'], required: true },
  role: { type: String, enum: ['customer', 'seller', 'admin', 'corporate', 'unknown'], default: 'unknown' },
  userId: { type: mongoose.Schema.Types.ObjectId, default: null },
  email: { type: String, default: '', lowercase: true, trim: true },
  ipAddress: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  reason: { type: String, default: '' },
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

authAuditLogSchema.index({ role: 1, action: 1, createdAt: -1 });
authAuditLogSchema.index({ userId: 1, createdAt: -1 });
authAuditLogSchema.index({ email: 1, createdAt: -1 });
authAuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

module.exports = mongoose.model('AuthAuditLog', authAuditLogSchema);
