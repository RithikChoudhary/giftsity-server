const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true },
  orderType: {
    type: String,
    enum: ['b2c_marketplace', 'b2b_direct'],
    default: 'b2c_marketplace'
  },

  // Customer
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: false, default: null },
  customerEmail: { type: String, default: '' },
  customerPhone: { type: String, default: '' },

  // Seller (for B2C marketplace)
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },

  // Items (must have at least 1)
  items: { type: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    title: String,
    price: Number,
    image: String,
    sku: String,
    quantity: { type: Number, default: 1 },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },
    customizations: [{
      label: { type: String, default: '' },
      value: { type: String, default: '' },
      imageUrls: [{ type: String }]
    }]
  }], validate: [arr => arr.length > 0, 'Order must have at least one item'] },

  // Shipping
  shippingAddress: {
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' }
  },

  // Pricing
  itemTotal: { type: Number, default: 0 },
  shippingCost: { type: Number, default: 0 }, // what customer sees (includes markup if customer pays)
  actualShippingCost: { type: Number, default: 0 }, // actual Shiprocket rate (for courier cap)
  shippingPaidBy: { type: String, enum: ['seller', 'customer'], default: 'seller' },
  totalAmount: { type: Number, default: 0 },

  // Commission
  commissionRate: { type: Number, default: 0 },
  commissionAmount: { type: Number, default: 0 },
  paymentGatewayFee: { type: Number, default: 0 },
  sellerAmount: { type: Number, default: 0 },

  // Payment
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded', 'refund_pending'],
    default: 'pending'
  },
  refundId: { type: String, default: '' },
  refundRetryCount: { type: Number, default: 0 },
  cashfreeOrderId: { type: String, default: '' },
  cashfreePaymentId: { type: String, default: '' },
  paymentSessionId: { type: String, default: '' },
  paidAt: { type: Date, default: null },

  // Order status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending'
  },

  // Tracking
  trackingInfo: {
    courierName: { type: String, default: '' },
    trackingNumber: { type: String, default: '' },
    shippedAt: { type: Date, default: null },
    estimatedDelivery: { type: Date, default: null }
  },

  deliveredAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  cancelReason: { type: String, default: '' },

  // Payout
  payoutStatus: {
    type: String,
    enum: ['pending', 'included_in_payout', 'paid'],
    default: 'pending'
  },
  payoutId: { type: mongoose.Schema.Types.ObjectId, ref: 'SellerPayout', default: null },

  // Returns
  returnRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReturnRequest', default: null },
  returnStatus: {
    type: String,
    enum: ['none', 'requested', 'approved', 'completed', 'rejected'],
    default: 'none'
  },

  // Status change audit trail
  statusHistory: [{
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId },
    changedByRole: { type: String, enum: ['customer', 'seller', 'admin', 'system'], default: 'system' },
    note: { type: String, default: '' }
  }],

  // Coupon/discount
  couponCode: { type: String, default: '' },
  discountAmount: { type: Number, default: 0 },

  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// orderNumber uniqueness handled by schema `unique: true`
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ sellerId: 1, status: 1 });
orderSchema.index({ payoutStatus: 1, deliveredAt: 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ cashfreeOrderId: 1 });
orderSchema.index({ sellerId: 1, paymentStatus: 1, status: 1, payoutStatus: 1 });

orderSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Order', orderSchema);
