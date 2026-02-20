/**
 * Weight Disputes Route — Seller Dashboard
 *
 * Provides an endpoint for sellers to check weight discrepancies
 * between declared and charged weights on their shipments.
 * Read-only: fetches data from DB + Shiprocket API.
 */

const express = require('express');
const { requireAuth, requireSeller } = require('../middleware/auth');
const { getWeightDiscrepancy } = require('../utils/weightReconciliation');
const logger = require('../utils/logger');
const router = express.Router();

router.use(requireAuth, requireSeller);

// GET /api/seller/weight-disputes/:orderId
router.get('/:orderId', async (req, res) => {
  try {
    const result = await getWeightDiscrepancy(req.params.orderId, req.user._id);
    res.json(result);
  } catch (err) {
    logger.error('[WeightDispute] Error:', err.message);
    res.status(500).json({ message: 'Failed to check weight discrepancy' });
  }
});

module.exports = router;
