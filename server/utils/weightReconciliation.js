/**
 * Weight Reconciliation Utility
 *
 * Compares the declared shipment weight (from our DB) with the weight
 * charged by Shiprocket/courier. Flags discrepancies for the seller dashboard.
 * Reads from DB only — does not modify any records.
 */

const Shipment = require('../models/Shipment');
const shiprocket = require('../config/shiprocket');
const logger = require('./logger');

async function getWeightDiscrepancy(orderId, sellerId) {
  const shipment = await Shipment.findOne({ orderId, sellerId }).lean();
  if (!shipment) {
    return { found: false, message: 'No shipment found for this order' };
  }

  if (!shipment.shiprocketOrderId) {
    return { found: false, message: 'No Shiprocket order linked' };
  }

  let shiprocketData = null;
  try {
    shiprocketData = await shiprocket.getShiprocketOrderDetails(shipment.shiprocketOrderId);
  } catch (err) {
    logger.warn(`[Weight] Could not fetch Shiprocket details for order ${shipment.shiprocketOrderId}: ${err.message}`);
    return { found: false, message: 'Could not fetch Shiprocket order details' };
  }

  const srShipments = shiprocketData?.data?.shipments || shiprocketData?.shipments || [];
  const srShipment = srShipments[0];

  if (!srShipment) {
    return { found: false, message: 'No shipment data from Shiprocket' };
  }

  const declaredWeight = shipment.weight; // grams
  const chargedWeight = (srShipment.charged_weight || srShipment.weight) * 1000; // kg -> grams

  return {
    found: true,
    orderId: orderId.toString(),
    awb: shipment.awbCode,
    declaredWeightGrams: declaredWeight,
    chargedWeightGrams: Math.round(chargedWeight),
    hasDiscrepancy: chargedWeight > declaredWeight * 1.1, // 10% tolerance
    discrepancyGrams: Math.round(chargedWeight - declaredWeight),
    shippingCharge: shipment.shippingCharge,
    courierName: shipment.courierName
  };
}

module.exports = { getWeightDiscrepancy };
