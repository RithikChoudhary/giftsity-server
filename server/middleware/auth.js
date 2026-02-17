const jwt = require('jsonwebtoken');
const { findIdentityByToken, normalizeUser } = require('../utils/identity');
const { logAuthEvent } = require('../utils/audit');

// Verify JWT token
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const identity = await findIdentityByToken(decoded);
    if (!identity) {
      logAuthEvent(req, { action: 'token_rejected', reason: 'identity_not_found' }).catch(() => {});
      return res.status(401).json({ message: 'User not found' });
    }

    const user = normalizeUser(identity.entity, identity.role, identity.source);
    if (!user) return res.status(401).json({ message: 'User not found' });
    // Allow suspended sellers to authenticate (they need to request unsuspend)
    // Non-seller suspended users are still blocked
    if (user.status === 'suspended' && user.userType !== 'seller') {
      return res.status(403).json({ message: 'Account suspended' });
    }

    req.user = identity.entity;
    req.user.userType = user.userType;
    req.user.role = identity.role;
    req.identitySource = identity.source;
    next();
  } catch (err) {
    logAuthEvent(req, { action: 'token_rejected', reason: 'invalid_or_expired' }).catch(() => {});
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Require seller role
const requireSeller = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Authentication required' });
  if (req.user.userType !== 'seller' && req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Seller access required' });
  }
  // Allow suspended sellers to access dashboard, settings, and unsuspend
  const allowedForSuspended = ['/dashboard', '/settings', '/request-unsuspend'];
  if (req.user.userType === 'seller' && req.user.status === 'suspended') {
    const path = req.path || req.url;
    if (!allowedForSuspended.some(p => path === p || path.startsWith(p))) {
      return res.status(403).json({ message: 'Account suspended. Limited access.' });
    }
  }
  // Block pending sellers from most actions
  if (req.user.userType === 'seller' && req.user.status === 'pending') {
    const allowedForPending = ['/dashboard', '/settings'];
    const path = req.path || req.url;
    if (!allowedForPending.some(p => path === p || path.startsWith(p))) {
      return res.status(403).json({ message: 'Account pending approval' });
    }
  }
  next();
};

// Require admin role
const requireAdmin = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Authentication required' });
  if (req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

module.exports = { requireAuth, requireSeller, requireAdmin };
