const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },

  rating: { type: Number, required: true, min: 1, max: 5 },
  reviewText: { type: String, default: '' },
  images: [{
    url: { type: String, default: '' },
    publicId: { type: String, default: '' }
  }],

  isApproved: { type: Boolean, default: true },
  isHidden: { type: Boolean, default: false },
  hiddenReason: { type: String, default: '' },

  helpfulCount: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now }
});

reviewSchema.index({ productId: 1 });
reviewSchema.index({ customerId: 1 });
reviewSchema.index({ sellerId: 1 });
reviewSchema.index({ orderId: 1 });
// Prevent duplicate reviews: one review per customer per product per order
reviewSchema.index({ orderId: 1, customerId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
