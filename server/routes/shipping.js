const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();

// DEPRECATED: This legacy webhook handler is superseded by /api/tracking/webhook
// (server/routes/shiprocket.js) which has proper status mapping, RTO/NDR handling,
// scan history deduplication, and forward-only status progression.
// This endpoint is kept alive to avoid 404s if Shiprocket still hits it,
// but it simply logs and returns 200 without processing.

router.post('/webhook', async (req, res) => {
  logger.warn('[Shipping Webhook DEPRECATED] Received webhook on legacy /api/shipping/webhook — use /api/tracking/webhook instead');
  res.status(200).json({ message: 'ok', deprecated: true, useInstead: '/api/tracking/webhook' });
});

module.exports = router;
