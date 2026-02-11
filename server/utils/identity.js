const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Seller = require('../models/Seller');
const Admin = require('../models/Admin');
const CorporateUser = require('../models/CorporateUser');
const AuthSession = require('../models/AuthSession');

// When false, skip legacy User collection lookups entirely (set after migration is verified)
function isLegacyFallbackEnabled() {
  const flag = process.env.LEGACY_USER_FALLBACK;
  // Default true during transition; explicitly set to 'false' to disable
  return flag !== 'false';
}

const ROLE_TO_MODEL = {
  customer: Customer,
  seller: Seller,
  admin: Admin,
  corporate: CorporateUser
};

function roleToLegacyUserType(role) {
  if (role === 'customer') return 'customer';
  if (role === 'seller') return 'seller';
  if (role === 'admin') return 'admin';
  return role;
}

function normalizeUser(entity, role, source = 'new') {
  if (!entity) return null;
  const userType = source === 'legacy' ? entity.userType : roleToLegacyUserType(role);
  return {
    _id: entity._id,
    email: entity.email,
    name: entity.name || entity.contactPerson || entity.companyName || '',
    phone: entity.phone || '',
    userType,
    role,
    status: entity.status || 'active',
    isProfileComplete: entity.isProfileComplete !== undefined ? entity.isProfileComplete : true,
    shippingAddresses: entity.shippingAddresses || [],
    sellerProfile: userType === 'seller' ? entity.sellerProfile : undefined,
    raw: entity
  };
}

async function findIdentityByEmail(email) {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  if (!normalizedEmail) return null;

  const queries = [
    Customer.findOne({ email: normalizedEmail }),
    Seller.findOne({ email: normalizedEmail }),
    Admin.findOne({ email: normalizedEmail }),
    isLegacyFallbackEnabled() ? User.findOne({ email: normalizedEmail }) : Promise.resolve(null)
  ];

  const [customer, seller, admin, legacy] = await Promise.all(queries);

  if (customer) return { role: 'customer', source: 'new', entity: customer };
  if (seller) return { role: 'seller', source: 'new', entity: seller };
  if (admin) return { role: 'admin', source: 'new', entity: admin };
  if (legacy) return { role: legacy.userType, source: 'legacy', entity: legacy };
  return null;
}

async function findIdentityByToken(decoded) {
  if (decoded?.role && decoded?.subjectId) {
    const Model = ROLE_TO_MODEL[decoded.role];
    if (Model) {
      const entity = await Model.findById(decoded.subjectId);
      if (entity) return { role: decoded.role, source: 'new', entity };
    }
  }

  // Backward compatibility with existing tokens (controlled by LEGACY_USER_FALLBACK)
  if (decoded?.userId && isLegacyFallbackEnabled()) {
    const legacy = await User.findById(decoded.userId);
    if (legacy) return { role: legacy.userType, source: 'legacy', entity: legacy };
  }

  return null;
}

function signIdentityToken(identity) {
  const payload = {
    role: identity.role,
    subjectId: identity.entity._id.toString(),
    source: identity.source
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' });
}

function getAuthMeta(req) {
  return {
    ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
    userAgent: req.headers['user-agent'] || '',
    deviceId: req.headers['x-device-id'] || ''
  };
}

async function createAuthSession(token, identity, req) {
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const meta = getAuthMeta(req);
    await AuthSession.create({
      userRole: identity.role,
      userId: identity.entity._id,
      tokenHash,
      expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      deviceId: meta.deviceId
    });
  } catch (err) {
    // Session logging should not block auth
  }
}

/**
 * Find all roles that exist for a given email.
 * Returns array like ['customer', 'seller'] or ['customer'].
 */
async function findAllRolesForEmail(email) {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  if (!normalizedEmail) return [];

  const [customer, seller, admin] = await Promise.all([
    Customer.findOne({ email: normalizedEmail }).select('_id').lean(),
    Seller.findOne({ email: normalizedEmail }).select('_id').lean(),
    Admin.findOne({ email: normalizedEmail }).select('_id').lean()
  ]);

  const roles = [];
  if (customer) roles.push('customer');
  if (seller) roles.push('seller');
  if (admin) roles.push('admin');
  return roles;
}

/**
 * Find a specific role's identity for an email.
 */
async function findIdentityByEmailAndRole(email, role) {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  if (!normalizedEmail || !role) return null;

  const Model = ROLE_TO_MODEL[role];
  if (!Model) return null;

  const entity = await Model.findOne({ email: normalizedEmail });
  if (!entity) return null;
  return { role, source: 'new', entity };
}

module.exports = {
  ROLE_TO_MODEL,
  normalizeUser,
  findIdentityByEmail,
  findIdentityByToken,
  signIdentityToken,
  createAuthSession,
  getAuthMeta,
  findAllRolesForEmail,
  findIdentityByEmailAndRole
};
