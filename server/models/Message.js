const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  senderRole: { type: String, enum: ['customer', 'seller'], required: true },
  senderName: { type: String, default: '' },

  content: { type: String, default: '' },
  images: [{ type: String }],

  readAt: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now }
});

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ conversationId: 1, readAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
