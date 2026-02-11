const sanitizeHtml = require('sanitize-html');

const sanitizeOptions = {
  allowedTags: [], // Strip all HTML tags by default
  allowedAttributes: {},
  disallowedTagsMode: 'discard'
};

/**
 * Recursively sanitize all string values in an object
 */
function sanitizeObject(obj) {
  if (typeof obj === 'string') {
    return sanitizeHtml(obj, sanitizeOptions);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  return obj;
}

/**
 * Express middleware that sanitizes all string fields in req.body
 * to prevent XSS attacks from user-generated content.
 */
function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

module.exports = { sanitizeBody, sanitizeObject };
