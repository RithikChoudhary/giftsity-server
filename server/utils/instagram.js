const axios = require('axios');

/**
 * Verify that an Instagram username exists by checking the public profile.
 * Makes a HEAD request to instagram.com/{username}/ and checks the status.
 * 
 * @param {string} username - Instagram username (without @)
 * @returns {Promise<{exists: boolean, username: string}>}
 */
async function verifyInstagramUsername(username) {
  if (!username || typeof username !== 'string') {
    return { exists: false, username: '' };
  }

  const clean = username.replace('@', '').trim().toLowerCase();
  if (!clean || !/^[a-zA-Z0-9._]{1,30}$/.test(clean)) {
    return { exists: false, username: clean };
  }

  try {
    const res = await axios.head(`https://www.instagram.com/${clean}/`, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      maxRedirects: 3,
      validateStatus: (status) => status < 500 // Don't throw on 4xx
    });

    // Only a definitive 404 means the account does not exist.
    // Any other status (200, 301, 302, 401, 403, etc.) could mean Instagram
    // is blocking/rate-limiting the request, so fail-open to avoid false negatives.
    const exists = res.status !== 404;
    return { exists, username: clean };
  } catch (err) {
    // Network error or timeout — don't block registration, assume valid
    console.warn(`[Instagram] Verification request failed for @${clean}:`, err.message);
    return { exists: true, username: clean }; // fail-open: don't block user
  }
}

module.exports = { verifyInstagramUsername };
