const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema({
  channel: { type: String, enum: ['email', 'sms', 'whatsapp', 'push'], required: true },
  recipient: { type: String, required: true },
  recipientRole: { type: String, enum: ['customer', 'seller', 'admin', 'corporate', 'unknown'], default: 'unknown' },
  template: { type: String, default: '' },
  subject: { type: String, default: '' },
  status: { type: String, enum: ['queued', 'sent', 'failed'], default: 'queued' },
  provider: { type: String, default: '' },
  providerMessageId: { type: String, default: '' },
  errorMessage: { type: String, default: '' },
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

notificationLogSchema.index({ recipient: 1, createdAt: -1 });
notificationLogSchema.index({ channel: 1, status: 1, createdAt: -1 });

notificationLogSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
