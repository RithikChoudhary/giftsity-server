/**
 * COD (Cash on Delivery) Handler — Scaffold
 *
 * Placeholder for future COD support. Currently all orders are prepaid.
 * This file provides a clean API surface so COD can be enabled without
 * touching existing payment/order logic.
 */

const logger = require('./logger');

function isCODEnabled() {
  return false;
}

function calculateCODCharges(orderTotal) {
  if (!isCODEnabled()) return 0;
  // Typical COD charge: flat Rs. 40 or 2% of order total, whichever is higher
  return Math.max(40, Math.round(orderTotal * 0.02));
}

async function handleCODRemittance(_order) {
  logger.warn('[COD] COD remittance not implemented — prepaid only');
  return { success: false, message: 'COD not enabled' };
}

module.exports = { isCODEnabled, calculateCODCharges, handleCODRemittance };
