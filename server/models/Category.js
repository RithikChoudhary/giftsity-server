const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  image: {
    url: { type: String, default: '' },
    publicId: { type: String, default: '' }
  },
  icon: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 },
  productCount: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now }
});

// slug uniqueness handled by schema `unique: true`
categorySchema.index({ isActive: 1, displayOrder: 1 });

module.exports = mongoose.model('Category', categorySchema);
