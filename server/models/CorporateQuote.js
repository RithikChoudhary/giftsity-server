const mongoose = require('mongoose');

const corporateQuoteSchema = new mongoose.Schema({
  quoteNumber: { type: String, unique: true },
  inquiryId: { type: mongoose.Schema.Types.ObjectId, ref: 'B2BInquiry', default: null },
  corporateUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'CorporateUser', default: null },

  companyName: { type: String, required: true },
  contactEmail: { type: String, required: true },
  contactPhone: { type: String, default: '' },

  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    title: { type: String, default: '' },
    image: { type: String, default: '' },
    unitPrice: { type: Number, default: 0 },
    quantity: { type: Number, default: 1 },
    subtotal: { type: Number, default: 0 }
  }],

  totalAmount: { type: Number, default: 0 },
  discountPercent: { type: Number, default: 0 },
  finalAmount: { type: Number, default: 0 },

  shippingAddress: {
    name: { type: String, default: '' },
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
    phone: { type: String, default: '' }
  },

  status: {
    type: String,
    enum: ['draft', 'sent', 'approved', 'rejected', 'expired', 'converted'],
    default: 'draft'
  },
  validUntil: { type: Date, default: null },

  adminNotes: { type: String, default: '' },
  clientNotes: { type: String, default: '' },

  convertedOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }, // admin who created
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// quoteNumber uniqueness handled by schema `unique: true`
corporateQuoteSchema.index({ corporateUserId: 1, status: 1 });
corporateQuoteSchema.index({ status: 1, createdAt: -1 });

corporateQuoteSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('CorporateQuote', corporateQuoteSchema);
