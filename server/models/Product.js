const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
  title: { type: String, required: true },
  slug: { type: String, unique: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 1 },
  comparePrice: {
    type: Number, default: null,
    validate: {
      validator: function(v) { return !v || v > this.price; },
      message: 'Compare price must be greater than selling price'
    }
  },
  category: { type: String, required: true },
  subcategory: { type: String, default: '' },

  images: [{
    url: { type: String, required: true },
    publicId: { type: String, default: '' }
  }],

  // Media (images + videos for Instagram-style display)
  media: [{
    type: { type: String, enum: ['image', 'video'], default: 'image' },
    url: { type: String, required: true },
    thumbnailUrl: { type: String, default: '' },
    publicId: { type: String, default: '' },
    duration: { type: Number, default: 0 }, // seconds, for video
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 }
  }],

  stock: { type: Number, required: true, default: 0, min: 0 },
  sku: { type: String, default: '' },

  // Shipping info
  weight: { type: Number, default: 0 }, // grams
  dimensions: {
    length: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 }
  },

  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },

  // Analytics
  viewCount: { type: Number, default: 0 },
  orderCount: { type: Number, default: 0 },

  // Reviews aggregate (denormalized)
  averageRating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },

  tags: [{ type: String }],

  // Customization support
  isCustomizable: { type: Boolean, default: false },
  customizationOptions: [{
    label: { type: String, required: true },
    type: { type: String, enum: ['text', 'image', 'select'], default: 'text' },
    required: { type: Boolean, default: false },
    placeholder: { type: String, default: '' },
    maxLength: { type: Number, default: 100 },
    maxFiles: { type: Number, default: 5 },
    selectOptions: [{ type: String }],
    extraPrice: { type: Number, default: 0 }
  }],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

productSchema.index({ sellerId: 1 });
productSchema.index({ category: 1, isActive: 1 });
// slug uniqueness handled by schema `unique: true`
productSchema.index({ title: 'text', description: 'text', tags: 'text' });
productSchema.index({ isFeatured: 1, isActive: 1 });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });

productSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Product', productSchema);
