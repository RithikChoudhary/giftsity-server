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
 * @param {number} itemTotal - product price total (what seller earns from)
 * @param {number} paymentTotal - full amount charged to customer (itemTotal + customer-paid shipping)
 * @param {number} commissionRate - platform commission percentage
 * @param {number} gatewayFeeRate - payment gateway fee percentage
 */
const calculateOrderFinancials = (itemTotal, paymentTotal, commissionRate, gatewayFeeRate) => {
  // Commission is on item total only
  const commissionAmount = Math.round((itemTotal * commissionRate) / 100);
  // Gateway fee is on the full payment amount (what Cashfree actually charges)
  const paymentGatewayFee = Math.round((paymentTotal * gatewayFeeRate) / 100);
  // Seller receives item total minus commission and gateway fee
  const sellerAmount = itemTotal - commissionAmount - paymentGatewayFee;

  return {
    commissionRate,
    commissionAmount,
    paymentGatewayFee,
    sellerAmount: Math.max(0, sellerAmount)
  };
};

module.exports = { getCommissionRate, calculateOrderFinancials };
