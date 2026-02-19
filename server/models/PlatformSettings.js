const mongoose = require('mongoose');
const NodeCache = require('node-cache');

const settingsCache = new NodeCache({ stdTTL: 300, checkperiod: 60, useClones: false });

const platformSettingsSchema = new mongoose.Schema({
  // Commission
  globalCommissionRate: { type: Number, default: 0 },
  newSellerCommissionRate: { type: Number, default: null }, // null = use global
  commissionGrandfatherDate: { type: Date, default: null }, // sellers before this date keep old rate
  paymentGatewayFeeRate: { type: Number, default: 3 },

  // Payouts
  payoutSchedule: {
    type: String,
    enum: ['weekly', 'biweekly', 'monthly'],
    default: 'biweekly'
  },
  minimumPayoutAmount: { type: Number, default: 0 },

  // Business rules
  minimumProductPrice: { type: Number, default: 200 },
  maxFeaturedProducts: { type: Number, default: 10 },
  maxImagesPerProduct: { type: Number, default: 5 },
  returnWindowDays: { type: Number, default: 7 },

  // Contact
  supportEmail: { type: String, default: '' },
  supportPhone: { type: String, default: '' },

  // Social
  instagramUrl: { type: String, default: '' },
  facebookUrl: { type: String, default: '' },
  whatsappNumber: { type: String, default: '' },

  // Platform info
  platformName: { type: String, default: 'Giftsity' },
  tagline: { type: String, default: 'The Gift Marketplace' },

  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null }
});

// Ensure only one settings document exists
platformSettingsSchema.statics.getSettings = async function () {
  const cached = settingsCache.get('ps');
  if (cached) return cached;

  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  // One-time migration: update old defaults
  let needsSave = false;
  if (settings.minimumPayoutAmount === 500) {
    settings.minimumPayoutAmount = 0;
    needsSave = true;
  }
  if (settings.paymentGatewayFeeRate === 2) {
    settings.paymentGatewayFeeRate = 3;
    needsSave = true;
  }
  if (needsSave) await settings.save();

  settingsCache.set('ps', settings);
  return settings;
};

platformSettingsSchema.statics.invalidateSettingsCache = function () {
  settingsCache.del('ps');
};

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
