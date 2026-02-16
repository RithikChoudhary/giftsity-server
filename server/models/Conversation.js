const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userRole: { type: String, enum: ['customer', 'seller'], required: true },
    name: { type: String, default: '' }
  }],

  // Optional: conversation started from a product page
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  productTitle: { type: String, default: '' },
  productImage: { type: String, default: '' },

  // Denormalized last message for conversation list
  lastMessage: {
    content: { type: String, default: '' },
    senderId: { type: mongoose.Schema.Types.ObjectId, default: null },
    sentAt: { type: Date, default: null }
  },

  // Per-participant unread counts (keyed by participant userId string)
  unreadCounts: { type: Map, of: Number, default: {} },

  status: { type: String, enum: ['active', 'archived'], default: 'active' },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

conversationSchema.index({ 'participants.userId': 1, updatedAt: -1 });
conversationSchema.index({ productId: 1 });

conversationSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Conversation', conversationSchema);
