const NodeCache = require('node-cache');

// Single shared cache instance
// stdTTL = default 120s, checkperiod = cleanup every 60s
const cache = new NodeCache({ stdTTL: 120, checkperiod: 60, useClones: false });

/**
 * Express middleware: cache GET responses in memory.
 * @param {number} ttlSeconds - Time-to-live in seconds (default 120)
 */
function cacheMiddleware(ttlSeconds = 120) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') return next();

    const key = req.originalUrl || req.url;
    const cached = cache.get(key);

    if (cached !== undefined) {
      return res.json(cached);
    }

    // Intercept res.json to cache the response body
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, body, ttlSeconds);
      }
      return originalJson(body);
    };

    next();
  };
}

/**
 * Invalidate cache entries matching a prefix or pattern.
 * @param {string} pattern - URL prefix to match (e.g. '/api/products')
 */
function invalidateCache(pattern) {
  const keys = cache.keys();
  const toDelete = keys.filter(k => k.includes(pattern));
  if (toDelete.length > 0) {
    cache.del(toDelete);
  }
}

/**
 * Flush the entire cache.
 */
function flushCache() {
  cache.flushAll();
}

module.exports = { cacheMiddleware, invalidateCache, flushCache, cache };
