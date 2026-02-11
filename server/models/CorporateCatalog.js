const mongoose = require('mongoose');

const corporateCatalogSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
  corporatePrice: { type: Number, default: null }, // null = use regular product price
  minOrderQty: { type: Number, default: 10 },
  maxOrderQty: { type: Number, default: 10000 },
  isActive: { type: Boolean, default: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  tags: [{ type: String }], // e.g. "diwali", "new-year", "welcome-kit"
  createdAt: { type: Date, default: Date.now }
});

corporateCatalogSchema.index({ productId: 1 }, { unique: true });
corporateCatalogSchema.index({ isActive: 1 });
corporateCatalogSchema.index({ tags: 1 });

module.exports = mongoose.model('CorporateCatalog', corporateCatalogSchema);
