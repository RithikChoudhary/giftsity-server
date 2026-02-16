const axios = require('axios');
const logger = require('./logger');

const INDEXNOW_KEY = process.env.INDEXNOW_API_KEY;
const SITE_HOST = 'giftsity.com';
const KEY_LOCATION = `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`;

/**
 * Submit URLs to IndexNow for instant indexing by Bing, Yandex, etc.
 * Fire-and-forget: never throws, logs success/failure.
 * @param {string|string[]} urls - one or more full URLs to submit
 */
async function submitToIndexNow(urls) {
  if (!INDEXNOW_KEY) return;

  const urlList = Array.isArray(urls) ? urls : [urls];
  if (urlList.length === 0) return;

  try {
    await axios.post('https://api.indexnow.org/IndexNow', {
      host: SITE_HOST,
      key: INDEXNOW_KEY,
      keyLocation: KEY_LOCATION,
      urlList
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    logger.info(`[IndexNow] Submitted ${urlList.length} URL(s): ${urlList[0]}${urlList.length > 1 ? ` (+${urlList.length - 1} more)` : ''}`);
  } catch (err) {
    logger.warn(`[IndexNow] Submit failed: ${err.response?.status || err.message}`);
  }
}

module.exports = { submitToIndexNow };
