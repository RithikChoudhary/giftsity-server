const mongoose = require('mongoose');

const b2bInquirySchema = new mongoose.Schema({
  companyName: { type: String, required: true },
  contactPerson: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },

  numberOfEmployees: { type: Number, default: 0 },
  budgetPerGift: { type: String, default: '' },
  quantityNeeded: { type: Number, default: 0 },
  occasion: { type: String, default: '' },
  specialRequirements: { type: String, default: '' },

  status: {
    type: String,
    enum: ['new', 'contacted', 'quoted', 'converted', 'lost'],
    default: 'new'
  },

  adminNotes: { type: String, default: '' },
  quotedAmount: { type: Number, default: 0 },

  convertedOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  convertedAt: { type: Date, default: null },

  activityLog: [{
    action: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  }],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

b2bInquirySchema.index({ status: 1, createdAt: -1 });
b2bInquirySchema.index({ email: 1 });

b2bInquirySchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('B2BInquiry', b2bInquirySchema);
