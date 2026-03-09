/**
 * Google Shopping / Content API for Shopping configuration.
 * Loads credentials from GOOGLE_APPLICATION_CREDENTIALS (file path) or
 * GOOGLE_SERVICE_ACCOUNT_JSON (base64-encoded JSON, for Render/Heroku).
 */

const { google } = require('googleapis');
const logger = require('../utils/logger');

const merchantId = process.env.GOOGLE_MERCHANT_ID || null;
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || null;
const credentialsBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || null;

let _authClient = null;

/**
 * @returns {boolean} true if merchant ID and credentials are configured
 */
const isConfigured = () => Boolean(merchantId && (credentialsPath || credentialsBase64));

/**
 * Get an authenticated client for Content API. Returns null if not configured.
 * @returns {Promise<{auth: import('google-auth-library').GoogleAuth | null, content: object}>}
 */
const getAuthClient = async () => {
  if (!isConfigured()) return null;

  if (_authClient) return _authClient;

  try {
    const options = { scopes: ['https://www.googleapis.com/auth/content'] };
    if (credentialsBase64) {
      const json = Buffer.from(credentialsBase64, 'base64').toString('utf8');
      options.credentials = JSON.parse(json);
    }
    // When using credentialsPath, GoogleAuth reads from GOOGLE_APPLICATION_CREDENTIALS env automatically

    const auth = new google.auth.GoogleAuth(options);

    const content = google.content({ version: 'v2.1', auth });
    _authClient = { auth, content };
    return _authClient;
  } catch (err) {
    logger.error('[Google Shopping] Failed to initialize auth:', err.message);
    return null;
  }
};

module.exports = {
  isConfigured,
  getAuthClient,
  merchantId
};
