const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  domain: { type: String, required: true }, // order, admin, seller, corporate, system
  action: { type: String, required: true },
  actorRole: { type: String, enum: ['customer', 'seller', 'admin', 'corporate', 'system'], default: 'system' },
  actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
  actorEmail: { type: String, default: '' },
  targetType: { type: String, default: '' },
  targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
  message: { type: String, default: '' },
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

activityLogSchema.index({ domain: 1, action: 1, createdAt: -1 });
activityLogSchema.index({ actorRole: 1, actorId: 1, createdAt: -1 });
activityLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
