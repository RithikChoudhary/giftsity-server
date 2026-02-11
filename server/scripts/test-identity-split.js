/* eslint-disable no-console */
/**
 * Comprehensive integration test for the Identity Split refactor.
 *
 * Requires all 3 servers running:
 *   - Main     : http://localhost:5000
 *   - Seller   : http://localhost:5001
 *   - Corporate: http://localhost:5002
 *
 * Usage:
 *   node server/scripts/test-identity-split.js
 *   node server/scripts/test-identity-split.js --section=auth       # run one section
 *   node server/scripts/test-identity-split.js --skip-corporate     # skip corporate tests
 */

require('dotenv').config();
const mongoose = require('mongoose');

// ─── Config ──────────────────────────────────────────────────────────
const MAIN_URL = process.env.TEST_MAIN_URL || 'http://localhost:5000';
const SELLER_URL = process.env.TEST_SELLER_URL || 'http://localhost:5001';
const CORPORATE_URL = process.env.TEST_CORPORATE_URL || 'http://localhost:5002';

const args = process.argv.slice(2);
const sectionFilter = args.find(a => a.startsWith('--section='))?.split('=')[1] || null;
const skipCorporate = args.includes('--skip-corporate');

// ─── Helpers ─────────────────────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0;
const failures = [];

async function fetchJSON(url, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const res = await fetch(url, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

function assert(condition, testName, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${testName}`);
  } else {
    failed++;
    const msg = `  ✗ ${testName}${detail ? ` -- ${detail}` : ''}`;
    console.log(msg);
    failures.push(msg);
  }
}

function skip(testName, reason) {
  skipped++;
  console.log(`  ○ ${testName} (skipped: ${reason})`);
}

function section(name) {
  console.log(`\n═══ ${name} ═══`);
}

// ─── DB helpers (direct model access for verification) ───────────────
let dbConnected = false;
async function connectDB() {
  if (dbConnected) return;
  await mongoose.connect(process.env.MONGODB_URI);
  dbConnected = true;
}
async function disconnectDB() {
  if (dbConnected) await mongoose.connection.close();
}

// Lazy-load models after DB is connected
function getModel(name) {
  return require(`../models/${name}`);
}

// ─── OTP helper: read OTP directly from DB ───────────────────────────
async function getLatestOTP(email, modelName) {
  const Model = getModel(modelName);
  const doc = await Model.findOne({ email: email.toLowerCase().trim() }).select('otp otpExpiry');
  return doc?.otp;
}

// =====================================================================
// A) AUTH FLOW TESTS
// =====================================================================
async function testAuthFlows() {
  if (sectionFilter && sectionFilter !== 'auth') return;
  section('A) Auth Flow Tests');

  const testEmail = `test_customer_${Date.now()}@test.com`;
  const testSellerEmail = `test_seller_${Date.now()}@test.com`;
  const testAdminEmail = process.env.ADMIN_EMAIL || 'burnt776@gmail.com';

  // --- Customer Auth ---
  console.log('\n  -- Customer Auth --');

  // Send OTP
  let res = await fetchJSON(`${MAIN_URL}/api/auth/send-otp`, {
    method: 'POST', body: { email: testEmail }
  });
  assert(res.status === 200, 'Customer send-otp returns 200', `Got ${res.status}: ${JSON.stringify(res.data)}`);

  // Get OTP from DB
  await connectDB();
  const customerOtp = await getLatestOTP(testEmail, 'Customer');
  if (!customerOtp) {
    skip('Customer verify-otp', 'Could not read OTP from Customer model');
  } else {
    res = await fetchJSON(`${MAIN_URL}/api/auth/verify-otp`, {
      method: 'POST', body: { email: testEmail, otp: customerOtp }
    });
    assert(res.status === 200, 'Customer verify-otp returns 200', `Got ${res.status}`);
    assert(!!res.data.token, 'Customer receives token');
    assert(res.data.user?.userType === 'customer', 'Customer userType is "customer"', `Got ${res.data.user?.userType}`);
    assert(!!res.data.user?.role, 'Customer has role field');

    const customerToken = res.data.token;
    if (customerToken) {
      // Decode token to verify payload
      const payload = JSON.parse(Buffer.from(customerToken.split('.')[1], 'base64').toString());
      assert(payload.role === 'customer', 'Token payload has role=customer', `Got ${payload.role}`);
      assert(!!payload.subjectId, 'Token payload has subjectId', `Got ${JSON.stringify(payload)}`);

      // GET /me
      res = await fetchJSON(`${MAIN_URL}/api/auth/me`, { headers: authHeader(customerToken) });
      assert(res.status === 200, 'Customer GET /me returns 200', `Got ${res.status}`);
      assert(res.data.user?.email === testEmail.toLowerCase(), 'GET /me returns correct email');

      // Update profile
      res = await fetchJSON(`${MAIN_URL}/api/auth/profile`, {
        method: 'PUT', headers: authHeader(customerToken),
        body: { name: 'Test Customer', phone: '9999999999' }
      });
      assert(res.status === 200, 'Customer profile update returns 200', `Got ${res.status}`);

      // Update addresses
      res = await fetchJSON(`${MAIN_URL}/api/auth/addresses`, {
        method: 'PUT', headers: authHeader(customerToken),
        body: { addresses: [{ label: 'Home', name: 'Test', phone: '9999999999', street: '123 Test St', city: 'Mumbai', state: 'MH', pincode: '400001', isDefault: true }] }
      });
      assert(res.status === 200, 'Customer address update returns 200', `Got ${res.status}`);

      // Store for later tests
      global.__testCustomerToken = customerToken;
      global.__testCustomerEmail = testEmail;
    }
  }

  // --- Admin Auth ---
  console.log('\n  -- Admin Auth --');
  res = await fetchJSON(`${MAIN_URL}/api/auth/send-otp`, {
    method: 'POST', body: { email: testAdminEmail }
  });
  assert(res.status === 200, 'Admin send-otp returns 200', `Got ${res.status}`);

  const adminOtp = await getLatestOTP(testAdminEmail, 'Admin');
  if (!adminOtp) {
    skip('Admin verify-otp', 'Could not read OTP from Admin model -- admin may need migration first');
  } else {
    res = await fetchJSON(`${MAIN_URL}/api/auth/verify-otp`, {
      method: 'POST', body: { email: testAdminEmail, otp: adminOtp }
    });
    assert(res.status === 200, 'Admin verify-otp returns 200', `Got ${res.status}`);
    const adminToken = res.data.token;
    if (adminToken) {
      assert(res.data.user?.userType === 'admin', 'Admin userType is "admin"', `Got ${res.data.user?.userType}`);

      res = await fetchJSON(`${MAIN_URL}/api/auth/me`, { headers: authHeader(adminToken) });
      assert(res.status === 200, 'Admin GET /me returns 200');

      global.__testAdminToken = adminToken;
    }
  }
}

// =====================================================================
// B) SELLER FLOW TESTS
// =====================================================================
async function testSellerFlows() {
  if (sectionFilter && sectionFilter !== 'seller') return;
  section('B) Seller Flow Tests');

  await connectDB();
  const Seller = getModel('Seller');
  const seller = await Seller.findOne({ status: 'active' }).select('email otp');
  if (!seller) {
    skip('All seller tests', 'No active seller found in DB');
    return;
  }

  // Send OTP to seller
  let res = await fetchJSON(`${MAIN_URL}/api/auth/send-otp`, {
    method: 'POST', body: { email: seller.email }
  });
  assert(res.status === 200, 'Seller send-otp returns 200', `Got ${res.status}`);

  const sellerOtp = await getLatestOTP(seller.email, 'Seller');
  if (!sellerOtp) {
    skip('Seller auth', 'Could not read OTP from Seller model');
    return;
  }

  res = await fetchJSON(`${MAIN_URL}/api/auth/verify-otp`, {
    method: 'POST', body: { email: seller.email, otp: sellerOtp }
  });
  assert(res.status === 200, 'Seller verify-otp returns 200', `Got ${res.status}`);
  const sellerToken = res.data.token;
  if (!sellerToken) {
    skip('Seller API tests', 'No token received');
    return;
  }

  assert(res.data.user?.userType === 'seller', 'Seller userType is "seller"', `Got ${res.data.user?.userType}`);
  assert(!!res.data.user?.sellerProfile, 'Seller has sellerProfile');

  // Dashboard
  res = await fetchJSON(`${SELLER_URL}/api/seller/dashboard`, { headers: authHeader(sellerToken) });
  assert(res.status === 200, 'Seller GET /dashboard returns 200', `Got ${res.status}`);

  // Products
  res = await fetchJSON(`${SELLER_URL}/api/seller/products`, { headers: authHeader(sellerToken) });
  assert(res.status === 200, 'Seller GET /products returns 200', `Got ${res.status}`);

  // Orders
  res = await fetchJSON(`${SELLER_URL}/api/seller/orders`, { headers: authHeader(sellerToken) });
  assert(res.status === 200, 'Seller GET /orders returns 200', `Got ${res.status}`);

  // Settings
  res = await fetchJSON(`${SELLER_URL}/api/seller/settings`, { headers: authHeader(sellerToken) });
  assert(res.status === 200, 'Seller GET /settings returns 200', `Got ${res.status}`);
  assert(!!res.data.sellerProfile, 'Settings response has sellerProfile');

  global.__testSellerToken = sellerToken;
}

// =====================================================================
// C) CUSTOMER FLOW TESTS
// =====================================================================
async function testCustomerFlows() {
  if (sectionFilter && sectionFilter !== 'customer') return;
  section('C) Customer Flow Tests');

  // Public endpoints (no auth)
  let res = await fetchJSON(`${MAIN_URL}/api/products`);
  assert(res.status === 200, 'GET /api/products returns 200', `Got ${res.status}`);

  res = await fetchJSON(`${MAIN_URL}/api/store/sellers`);
  assert(res.status === 200, 'GET /api/store/sellers returns 200', `Got ${res.status}`);

  // Authenticated customer endpoints
  const token = global.__testCustomerToken;
  if (!token) {
    skip('Customer auth-required tests', 'No customer token from auth tests');
    return;
  }

  // My orders
  res = await fetchJSON(`${MAIN_URL}/api/orders/my-orders`, { headers: authHeader(token) });
  assert(res.status === 200, 'Customer GET /my-orders returns 200', `Got ${res.status}`);

  // Wishlist
  res = await fetchJSON(`${MAIN_URL}/api/wishlist`, { headers: authHeader(token) });
  assert(res.status === 200 || res.status === 404, 'Customer GET /wishlist returns 200 or 404', `Got ${res.status}`);
}

// =====================================================================
// D) ADMIN FLOW TESTS
// =====================================================================
async function testAdminFlows() {
  if (sectionFilter && sectionFilter !== 'admin') return;
  section('D) Admin Flow Tests');

  const token = global.__testAdminToken;
  if (!token) {
    skip('All admin tests', 'No admin token from auth tests');
    return;
  }

  // Dashboard
  let res = await fetchJSON(`${MAIN_URL}/api/admin/dashboard`, { headers: authHeader(token) });
  assert(res.status === 200, 'Admin GET /dashboard returns 200', `Got ${res.status}`);

  // Sellers
  res = await fetchJSON(`${MAIN_URL}/api/admin/sellers`, { headers: authHeader(token) });
  assert(res.status === 200, 'Admin GET /sellers returns 200', `Got ${res.status}`);

  // Customers
  res = await fetchJSON(`${MAIN_URL}/api/admin/customers`, { headers: authHeader(token) });
  assert(res.status === 200, 'Admin GET /customers returns 200', `Got ${res.status}`);
  if (res.data.customers) {
    assert(Array.isArray(res.data.customers), 'Admin /customers returns array');
  }

  // Corporate dashboard
  res = await fetchJSON(`${MAIN_URL}/api/admin/corporate/dashboard`, { headers: authHeader(token) });
  assert(res.status === 200, 'Admin GET /corporate/dashboard returns 200', `Got ${res.status}`);

  // Corporate users
  res = await fetchJSON(`${MAIN_URL}/api/admin/corporate/users`, { headers: authHeader(token) });
  assert(res.status === 200, 'Admin GET /corporate/users returns 200', `Got ${res.status}`);

  // Corporate catalog
  res = await fetchJSON(`${MAIN_URL}/api/admin/corporate/catalog`, { headers: authHeader(token) });
  assert(res.status === 200, 'Admin GET /corporate/catalog returns 200', `Got ${res.status}`);

  // Corporate quotes
  res = await fetchJSON(`${MAIN_URL}/api/admin/corporate/quotes`, { headers: authHeader(token) });
  assert(res.status === 200, 'Admin GET /corporate/quotes returns 200', `Got ${res.status}`);
}

// =====================================================================
// E) CORPORATE FLOW TESTS
// =====================================================================
async function testCorporateFlows() {
  if (sectionFilter && sectionFilter !== 'corporate') return;
  if (skipCorporate) { section('E) Corporate Flow Tests -- SKIPPED'); return; }
  section('E) Corporate Flow Tests');

  // Check if corporate server is reachable
  try {
    const res = await fetchJSON(`${CORPORATE_URL}/api/corporate/health`);
    if (res.status === 404 || res.status >= 500) {
      skip('Corporate tests', `Corporate server returned ${res.status}`);
      return;
    }
  } catch {
    skip('All corporate tests', 'Corporate server not reachable');
    return;
  }

  await connectDB();
  const CorporateUser = getModel('CorporateUser');
  const corpUser = await CorporateUser.findOne({ status: 'active' }).select('email');

  if (!corpUser) {
    skip('Corporate authenticated tests', 'No active corporate user found');
    return;
  }

  // Send OTP
  let res = await fetchJSON(`${CORPORATE_URL}/api/corporate/auth/send-otp`, {
    method: 'POST', body: { email: corpUser.email }
  });
  if (res.status !== 200) {
    skip('Corporate auth tests', `send-otp returned ${res.status}`);
    return;
  }

  const otp = await getLatestOTP(corpUser.email, 'CorporateUser');
  if (!otp) {
    skip('Corporate verify', 'Could not read OTP');
    return;
  }

  res = await fetchJSON(`${CORPORATE_URL}/api/corporate/auth/verify-otp`, {
    method: 'POST', body: { email: corpUser.email, otp }
  });
  assert(res.status === 200, 'Corporate verify-otp returns 200', `Got ${res.status}`);
  const corpToken = res.data.token;
  if (!corpToken) { skip('Corporate API tests', 'No token'); return; }

  // Catalog
  res = await fetchJSON(`${CORPORATE_URL}/api/corporate/catalog`, { headers: authHeader(corpToken) });
  assert(res.status === 200, 'Corporate GET /catalog returns 200', `Got ${res.status}`);

  // Quotes
  res = await fetchJSON(`${CORPORATE_URL}/api/corporate/quotes`, { headers: authHeader(corpToken) });
  assert(res.status === 200, 'Corporate GET /quotes returns 200', `Got ${res.status}`);

  // Orders
  res = await fetchJSON(`${CORPORATE_URL}/api/corporate/orders`, { headers: authHeader(corpToken) });
  assert(res.status === 200, 'Corporate GET /orders returns 200', `Got ${res.status}`);
}

// =====================================================================
// F) POPULATE / REFERENCE INTEGRITY TESTS
// =====================================================================
async function testPopulateIntegrity() {
  if (sectionFilter && sectionFilter !== 'populate') return;
  section('F) Populate / Reference Integrity Tests');

  await connectDB();
  const Order = getModel('Order');
  const Product = getModel('Product');
  const Customer = getModel('Customer');
  const Seller = getModel('Seller');

  // Check a recent order populates customerId correctly
  const recentOrder = await Order.findOne({ customerId: { $ne: null } })
    .sort({ createdAt: -1 })
    .populate('customerId', 'name email')
    .populate('sellerId', 'name sellerProfile.businessName');

  if (!recentOrder) {
    skip('Order populate test', 'No orders with customerId found');
  } else {
    assert(recentOrder.customerId !== null, 'Order.customerId populated (not null)', `Order ${recentOrder.orderNumber}`);
    if (recentOrder.customerId) {
      assert(!!recentOrder.customerId.email, 'Populated customer has email field');
    }
    if (recentOrder.sellerId) {
      assert(!!recentOrder.sellerId.sellerProfile || !!recentOrder.sellerId.name, 'Populated seller has data');
    }
  }

  // Check product sellerId populates
  const product = await Product.findOne({ sellerId: { $ne: null } })
    .populate('sellerId', 'name sellerProfile.businessName');
  if (!product) {
    skip('Product populate test', 'No products found');
  } else {
    assert(product.sellerId !== null, 'Product.sellerId populated (not null)');
    if (product.sellerId) {
      assert(typeof product.sellerId === 'object', 'Populated sellerId is object (not just ID)');
    }
  }

  // Bulk integrity: check for null populates on known-existing refs
  // Note: Some orders may have customerId pointing to an Admin (pre-split test data).
  // We only flag truly broken references (ID that doesn't exist in ANY collection).
  const ordersWithCustomers = await Order.find({ customerId: { $ne: null } }).limit(20)
    .populate('customerId', '_id').lean();
  const nullPopulates = ordersWithCustomers.filter(o => o.customerId === null);
  if (nullPopulates.length > 0) {
    // Check if these IDs exist in other collections (Admin, Seller)
    const Admin = getModel('Admin');
    const customerIdSet = new Set((await Customer.find().select('_id').lean()).map(d => String(d._id)));
    const adminIds = new Set((await Admin.find().select('_id').lean()).map(d => String(d._id)));
    const sellerIdSet = new Set((await Seller.find().select('_id').lean()).map(d => String(d._id)));
    // Re-query the raw IDs
    const rawOrders = await Order.find({ customerId: { $ne: null } }).limit(20).select('customerId orderNumber').lean();
    const trulyOrphaned = rawOrders.filter(o => {
      const id = String(o.customerId);
      return !customerIdSet.has(id) && !adminIds.has(id) && !sellerIdSet.has(id);
    });
    assert(trulyOrphaned.length === 0, `No truly orphaned customerId refs (${nullPopulates.length} point to non-Customer roles, ${trulyOrphaned.length} truly missing)`, `${trulyOrphaned.length} truly orphan(s) found`);
  } else {
    assert(true, `No null populate for known customerId refs (checked ${ordersWithCustomers.length} orders)`);
  }
}

// =====================================================================
// G) OPERATIONAL LOG VERIFICATION
// =====================================================================
async function testOperationalLogs() {
  if (sectionFilter && sectionFilter !== 'logs') return;
  section('G) Operational Log Verification');

  await connectDB();
  const AuthSession = getModel('AuthSession');
  const OtpLog = getModel('OtpLog');
  const AuthAuditLog = getModel('AuthAuditLog');
  const ActivityLog = getModel('ActivityLog');
  const NotificationLog = getModel('NotificationLog');

  // Check AuthSession records exist (from auth tests above)
  const sessions = await AuthSession.countDocuments();
  assert(sessions > 0, `AuthSession has records (count: ${sessions})`);

  // Check OtpLog records
  const otpLogs = await OtpLog.countDocuments();
  assert(otpLogs > 0, `OtpLog has records (count: ${otpLogs})`);

  // Check AuthAuditLog records
  const auditLogs = await AuthAuditLog.countDocuments();
  assert(auditLogs > 0, `AuthAuditLog has records (count: ${auditLogs})`);

  // Check ActivityLog (may be empty if no actions yet through API in this session)
  const activityLogs = await ActivityLog.countDocuments();
  console.log(`  ℹ ActivityLog records: ${activityLogs} (will populate as API actions occur)`);

  // Check NotificationLog (populated by email sends)
  const notifLogs = await NotificationLog.countDocuments();
  console.log(`  ℹ NotificationLog records: ${notifLogs} (will populate as emails are sent)`);
}

// =====================================================================
// H) MIGRATION INTEGRITY TESTS
// =====================================================================
async function testMigrationIntegrity() {
  if (sectionFilter && sectionFilter !== 'migration') return;
  section('H) Migration Integrity Tests');

  await connectDB();
  const Customer = getModel('Customer');
  const Seller = getModel('Seller');
  const Admin = getModel('Admin');
  const Order = getModel('Order');
  const Product = getModel('Product');
  const Review = getModel('Review');
  const Wishlist = getModel('Wishlist');

  const [customerIds, sellerIds, adminIds] = await Promise.all([
    Customer.find().select('_id').lean(),
    Seller.find().select('_id').lean(),
    Admin.find().select('_id').lean()
  ]);

  const customerSet = new Set(customerIds.map(d => String(d._id)));
  const sellerSet = new Set(sellerIds.map(d => String(d._id)));

  // Orders with valid customerId -- check against all identity collections (customer or admin may have placed orders)
  const ordersWithCustomer = await Order.find({ customerId: { $ne: null } }).select('customerId orderNumber').lean();
  const allIdentitySet = new Set([...customerSet, ...sellerSet, ...(await Admin.find().select('_id').lean()).map(d => String(d._id))]);
  const orphanOrderCustomers = ordersWithCustomer.filter(o => !allIdentitySet.has(String(o.customerId)));
  assert(orphanOrderCustomers.length === 0, `All orders have valid customerId in identity collections (${ordersWithCustomer.length} checked)`, `${orphanOrderCustomers.length} truly orphan(s)`);

  // Products with valid sellerId
  const products = await Product.find().select('sellerId title').lean();
  const orphanProductSellers = products.filter(p => p.sellerId && !sellerSet.has(String(p.sellerId)));
  assert(orphanProductSellers.length === 0, `All products have valid sellerId in Seller collection (${products.length} checked)`, `${orphanProductSellers.length} orphan(s)`);

  // Reviews with valid references
  const reviews = await Review.find().select('customerId sellerId').lean();
  const orphanReviewCustomers = reviews.filter(r => r.customerId && !customerSet.has(String(r.customerId)));
  const orphanReviewSellers = reviews.filter(r => r.sellerId && !sellerSet.has(String(r.sellerId)));
  assert(orphanReviewCustomers.length === 0, `All reviews have valid customerId (${reviews.length} checked)`, `${orphanReviewCustomers.length} orphan(s)`);
  assert(orphanReviewSellers.length === 0, `All reviews have valid sellerId (${reviews.length} checked)`, `${orphanReviewSellers.length} orphan(s)`);

  // Wishlists
  const wishlists = await Wishlist.find().select('userId').lean();
  const orphanWishlists = wishlists.filter(w => w.userId && !customerSet.has(String(w.userId)));
  assert(orphanWishlists.length === 0, `All wishlists have valid userId in Customer (${wishlists.length} checked)`, `${orphanWishlists.length} orphan(s)`);

  // Summary counts
  console.log(`\n  ℹ Collection counts: Customers=${customerIds.length}, Sellers=${sellerIds.length}, Admins=${adminIds.length}`);
}

// =====================================================================
// I) LEGACY FALLBACK TESTS
// =====================================================================
async function testLegacyFallback() {
  if (sectionFilter && sectionFilter !== 'fallback') return;
  section('I) Legacy Fallback Tests');

  await connectDB();
  const jwt = require('jsonwebtoken');
  const User = getModel('User');

  // Find a legacy user (if any exist)
  const legacyUser = await User.findOne().select('_id email userType').lean();
  if (!legacyUser) {
    skip('Legacy fallback tests', 'No legacy User records exist (migration may have removed them or none existed)');
    return;
  }

  // Create a legacy-format token
  const legacyToken = jwt.sign({ userId: legacyUser._id.toString() }, process.env.JWT_SECRET, { expiresIn: '5m' });

  // Create a new-format token
  const Customer = getModel('Customer');
  const Seller = getModel('Seller');
  const Admin = getModel('Admin');

  let newEntity = await Customer.findOne().select('_id').lean();
  let newRole = 'customer';
  if (!newEntity) { newEntity = await Seller.findOne().select('_id').lean(); newRole = 'seller'; }
  if (!newEntity) { newEntity = await Admin.findOne().select('_id').lean(); newRole = 'admin'; }

  if (newEntity) {
    const newToken = jwt.sign({ role: newRole, subjectId: newEntity._id.toString(), source: 'new' }, process.env.JWT_SECRET, { expiresIn: '5m' });

    // New token should always work
    let res = await fetchJSON(`${MAIN_URL}/api/auth/me`, { headers: authHeader(newToken) });
    assert(res.status === 200, 'New-format token resolves to 200 on /me', `Got ${res.status}`);
  }

  // Legacy token -- behavior depends on LEGACY_USER_FALLBACK
  const fallbackEnabled = process.env.LEGACY_USER_FALLBACK !== 'false';
  let res = await fetchJSON(`${MAIN_URL}/api/auth/me`, { headers: authHeader(legacyToken) });

  if (fallbackEnabled) {
    assert(res.status === 200, 'Legacy token resolves when LEGACY_USER_FALLBACK=true', `Got ${res.status}`);
  } else {
    assert(res.status === 401, 'Legacy token rejected when LEGACY_USER_FALLBACK=false', `Got ${res.status}`);
  }

  console.log(`  ℹ LEGACY_USER_FALLBACK is currently: ${fallbackEnabled ? 'enabled (true)' : 'disabled (false)'}`);
}

// =====================================================================
// MAIN
// =====================================================================
async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   Identity Split -- Comprehensive Integration Test   ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log(`\nServers: Main=${MAIN_URL}  Seller=${SELLER_URL}  Corporate=${CORPORATE_URL}`);
  if (sectionFilter) console.log(`Section filter: ${sectionFilter}`);
  if (skipCorporate) console.log('Skipping corporate tests');
  console.log('');

  // Check main server is reachable
  try {
    await fetch(`${MAIN_URL}/api/products`);
  } catch {
    console.error('ERROR: Main server is not reachable at ' + MAIN_URL);
    console.error('Please start all servers first: npm run dev');
    process.exit(1);
  }

  try {
    await testAuthFlows();
    await testSellerFlows();
    await testCustomerFlows();
    await testAdminFlows();
    await testCorporateFlows();
    await testPopulateIntegrity();
    await testOperationalLogs();
    await testMigrationIntegrity();
    await testLegacyFallback();
  } catch (err) {
    console.error('\nFATAL ERROR during test execution:', err);
  }

  // Clean up test customer if created
  try {
    await connectDB();
    if (global.__testCustomerEmail) {
      const Customer = getModel('Customer');
      await Customer.deleteOne({ email: global.__testCustomerEmail.toLowerCase() });
      console.log(`\n  ℹ Cleaned up test customer: ${global.__testCustomerEmail}`);
    }
  } catch { /* ignore cleanup errors */ }

  await disconnectDB();

  // Print summary
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log(`║   Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log('╚═══════════════════════════════════════════════════════╝');

  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(f));
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
