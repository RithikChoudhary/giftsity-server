const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-otp -otpExpiry');

    if (!user) return res.status(401).json({ message: 'User not found' });
    // Allow suspended sellers to authenticate (they need to request unsuspend)
    // Non-seller suspended users are still blocked
    if (user.status === 'suspended' && user.userType !== 'seller') {
      return res.status(403).json({ message: 'Account suspended' });
    }

    req.user = user;
    next();
  } catch (err) {
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
