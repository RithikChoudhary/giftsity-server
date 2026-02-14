const mongoose = require('mongoose');

const sellerPayoutSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },

  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  periodLabel: { type: String, default: '' },

  orderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  orderCount: { type: Number, default: 0 },

  // Financials
  totalSales: { type: Number, default: 0 },
  commissionDeducted: { type: Number, default: 0 },
  gatewayFeesDeducted: { type: Number, default: 0 },
  shippingDeducted: { type: Number, default: 0 },
  netPayout: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['pending', 'processing', 'paid'],
    default: 'pending'
  },

  transactionId: { type: String, default: '' },
  paidAt: { type: Date, default: null },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },

  bankDetailsSnapshot: {
    accountHolderName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    ifscCode: { type: String, default: '' },
    bankName: { type: String, default: '' }
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

sellerPayoutSchema.index({ sellerId: 1, periodStart: 1 });
sellerPayoutSchema.index({ status: 1 });

sellerPayoutSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('SellerPayout', sellerPayoutSchema);
