const mongoose = require('mongoose');

const returnRequestSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },

  // Items being returned (supports partial returns)
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    title: { type: String, default: '' },
    quantity: { type: Number, default: 1 },
    price: { type: Number, default: 0 },
    image: { type: String, default: '' }
  }],

  type: { type: String, enum: ['return', 'exchange'], required: true },

  reason: {
    type: String,
    enum: ['defective', 'wrong_item', 'not_as_described', 'size_issue', 'changed_mind', 'other'],
    required: true
  },
  reasonDetails: { type: String, default: '' },

  // Proof images uploaded by customer
  images: [{ type: String }],

  status: {
    type: String,
    enum: ['requested', 'approved', 'rejected', 'shipped_back', 'received', 'refunded', 'exchanged', 'cancelled'],
    default: 'requested'
  },

  // Full audit trail of every status change
  statusHistory: [{
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId },
    changedByRole: { type: String, enum: ['customer', 'seller', 'admin', 'system'], default: 'system' },
    note: { type: String, default: '' }
  }],

  rejectionReason: { type: String, default: '' },

  // Refund details
  refundAmount: { type: Number, default: 0 },
  refundId: { type: String, default: '' },

  // Return shipping
  returnTrackingNumber: { type: String, default: '' },

  adminNotes: { type: String, default: '' },
  resolvedAt: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

returnRequestSchema.index({ orderId: 1 });
returnRequestSchema.index({ customerId: 1, createdAt: -1 });
returnRequestSchema.index({ sellerId: 1, status: 1 });

returnRequestSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ReturnRequest', returnRequestSchema);
