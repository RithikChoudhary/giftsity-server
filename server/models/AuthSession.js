const mongoose = require('mongoose');

const authSessionSchema = new mongoose.Schema({
  userRole: { type: String, enum: ['customer', 'seller', 'admin', 'corporate'], required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  tokenHash: { type: String, required: true },
  issuedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  isRevoked: { type: Boolean, default: false },
  revokedAt: { type: Date, default: null },
  revokeReason: { type: String, default: '' },
  ipAddress: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  deviceId: { type: String, default: '' },
  lastSeenAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

authSessionSchema.index({ userRole: 1, userId: 1, isRevoked: 1 });
authSessionSchema.index({ tokenHash: 1 }, { unique: true });
authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AuthSession', authSessionSchema);
