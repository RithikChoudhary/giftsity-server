const PlatformSettings = require('../models/PlatformSettings');

/**
 * Get the commission rate for a seller.
 * Seller-specific rate takes priority over global rate.
 */
const getCommissionRate = (seller, settings) => {
  // If seller has a custom rate set, use it
  if (seller.sellerProfile && seller.sellerProfile.commissionRate !== null && seller.sellerProfile.commissionRate !== undefined) {
    return seller.sellerProfile.commissionRate;
  }

  // Check if grandfathering applies
  if (settings.commissionGrandfatherDate && settings.newSellerCommissionRate !== null) {
    const sellerCreated = seller.createdAt || new Date();
    if (sellerCreated < settings.commissionGrandfatherDate) {
      return settings.globalCommissionRate; // old sellers keep global rate
    }
    return settings.newSellerCommissionRate; // new sellers get new rate
  }

  return settings.globalCommissionRate;
};

/**
 * Calculate financial breakdown for an order.
 */
const calculateOrderFinancials = (totalAmount, commissionRate, gatewayFeeRate) => {
  const commissionAmount = Math.round((totalAmount * commissionRate) / 100);
  const paymentGatewayFee = Math.round((totalAmount * gatewayFeeRate) / 100);
  const sellerAmount = totalAmount - commissionAmount - paymentGatewayFee;

  return {
    commissionRate,
    commissionAmount,
    paymentGatewayFee,
    sellerAmount: Math.max(0, sellerAmount)
  };
};

module.exports = { getCommissionRate, calculateOrderFinancials };
