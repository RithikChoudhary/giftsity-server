/**
 * Log request errors with full context (message, code, stack, validation, endpoint, sellerId, custom context).
 * Defensive: never throws; on any logging failure falls back to logger.error(label, err.message).
 * Do not log req.body, auth headers, or huge strings.
 */
const MAX_STACK_LENGTH = 2000;
const MAX_STRING_LENGTH = 500;

function safeStr(val) {
  if (val == null) return undefined;
  const s = String(val);
  return s.length > MAX_STRING_LENGTH ? s.slice(0, MAX_STRING_LENGTH) + '...' : s;
}

function logRequestError(logger, level, label, err, req, context) {
  if (!logger || typeof logger[level] !== 'function') return;
  try {
    const msg = err?.message != null ? String(err.message) : (err ? String(err) : 'Unknown error');
    const meta = {
      errMessage: msg,
      errCode: err?.code,
      errName: err?.name,
      endpoint: req ? `${req.method || '?'} ${req.originalUrl || req.url || '?'}` : undefined,
      sellerId: req?.user?._id?.toString?.(),
    };
    if (err?.stack && typeof err.stack === 'string') {
      meta.stack = err.stack.length > MAX_STACK_LENGTH ? err.stack.slice(0, MAX_STACK_LENGTH) + '...' : err.stack;
    }
    if (err?.errors && typeof err.errors === 'object') {
      try {
        meta.validationErrors = JSON.stringify(err.errors);
      } catch (_) {
        meta.validationErrors = '[unserializable]';
      }
    }
    if (context && typeof context === 'object') {
      for (const [k, v] of Object.entries(context)) {
        if (v === undefined || v === null) continue;
        if (typeof v === 'string') meta[k] = safeStr(v);
        else if (typeof v === 'number' || typeof v === 'boolean') meta[k] = v;
        else if (typeof v === 'object' && !Array.isArray(v)) meta[k] = JSON.stringify(v).length > MAX_STRING_LENGTH ? '[object]' : v;
        else meta[k] = v;
      }
    }
    logger[level](label, meta);
  } catch (_) {
    try {
      logger.error(label, err?.message ?? (err ? String(err) : 'Unknown error'));
    } catch (__) {}
  }
}

module.exports = { logRequestError };
