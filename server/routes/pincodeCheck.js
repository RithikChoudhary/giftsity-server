/**
 * Pincode Serviceability Check
 *
 * Lightweight public endpoint for early UI feedback on whether
 * a delivery pincode is serviceable. Does NOT gate payments.
 */

const express = require('express');
const shiprocket = require('../config/shiprocket');
const logger = require('../utils/logger');
const router = express.Router();

// GET /api/pincode/check?pickup=XXXXX&delivery=YYYYY
router.get('/check', async (req, res) => {
  try {
    const { pickup, delivery } = req.query;
    if (!pickup || !delivery) {
      return res.status(400).json({ message: 'Both pickup and delivery pincodes are required' });
    }

    if (!/^\d{6}$/.test(pickup) || !/^\d{6}$/.test(delivery)) {
      return res.status(400).json({ message: 'Pincodes must be 6 digits' });
    }

    const result = await shiprocket.checkServiceability({
      pickupPincode: pickup,
      deliveryPincode: delivery,
      weight: 500, // default 500g for serviceability check
      cod: 0
    });

    const companies = result?.data?.available_courier_companies || result?.available_courier_companies || [];

    res.json({
      serviceable: companies.length > 0,
      courierCount: companies.length,
      cheapestRate: companies.length > 0
        ? Math.round(companies.reduce((min, c) => c.rate < min.rate ? c : min, companies[0]).rate)
        : null
    });
  } catch (err) {
    logger.error('[PincodeCheck] Error:', err.message);
    res.status(500).json({ message: 'Could not check serviceability' });
  }
});

module.exports = router;
