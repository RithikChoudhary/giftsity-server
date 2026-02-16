const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  userRole: { type: String, enum: ['customer', 'seller', 'admin', 'corporate'], required: true },

  type: {
    type: String,
    enum: [
      'order_confirmed', 'order_shipped', 'order_delivered', 'order_cancelled',
      'new_message',
      'return_requested', 'return_approved', 'return_rejected', 'return_refunded',
      'payout_processed', 'payout_failed',
      'review_received',
      'seller_approved', 'seller_suspended',
      'general'
    ],
    required: true
  },

  title: { type: String, required: true },
  message: { type: String, default: '' },
  link: { type: String, default: '' },
  metadata: { type: Object, default: {} },

  isRead: { type: Boolean, default: false },
  readAt: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now }
});

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
