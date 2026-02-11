/* eslint-disable no-console */
/**
 * Full App Flow -- End-to-End API Integration Test
 *
 * Tests ~75 endpoints across 3 servers (Main, Seller, Corporate),
 * simulating the complete business lifecycle from registration to order delivery.
 *
 * Requires all 3 servers running:
 *   - Main     : http://localhost:5000
 *   - Seller   : http://localhost:5001
 *   - Corporate: http://localhost:5002
 *
 * Usage:
 *   node server/scripts/test-app-flow.js
 *   node server/scripts/test-app-flow.js --section=auth
 *   node server/scripts/test-app-flow.js --skip-corporate
 */

require('dotenv').config();
const mongoose = require('mongoose');

// ─── Config ──────────────────────────────────────────────────────────
const MAIN = process.env.TEST_MAIN_URL || 'http://localhost:5000';
const SELLER = process.env.TEST_SELLER_URL || 'http://localhost:5001';
const CORPORATE = process.env.TEST_CORPORATE_URL || 'http://localhost:5002';
const TS = Date.now();

const args = process.argv.slice(2);
const sectionFilter = args.find(a => a.startsWith('--section='))?.split('=')[1] || null;
const skipCorporate = args.includes('--skip-corporate');

// ─── Helpers ─────────────────────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0;
const failures = [];

async function api(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const fetchOpts = { ...opts, headers };
  if (opts.formData) {
    // multipart form data -- let fetch set Content-Type with boundary
    const fd = new FormData();
    for (const [k, v] of Object.entries(opts.formData)) fd.append(k, String(v));
    fetchOpts.body = fd;
    delete fetchOpts.formData;
  } else {
    headers['Content-Type'] = 'application/json';
    if (opts.body && typeof opts.body === 'object') {
      fetchOpts.body = JSON.stringify(opts.body);
    }
  }
  const res = await fetch(url, fetchOpts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, ok: res.status >= 200 && res.status < 300 };
}

function auth(token) { return { Authorization: `Bearer ${token}` }; }

function ok(condition, name, detail = '') {
  if (condition) { passed++; console.log(`  + ${name}`); }
  else { failed++; const m = `  X ${name}${detail ? ` -- ${detail}` : ''}`; console.log(m); failures.push(m); }
}

function skp(name, reason) { skipped++; console.log(`  o ${name} (skipped: ${reason})`); }

function sec(name) { console.log(`\n=== ${name} ===`); }

function shouldRun(name) { return !sectionFilter || sectionFilter === name; }

// ─── DB ──────────────────────────────────────────────────────────────
let dbUp = false;
async function db() { if (!dbUp) { await mongoose.connect(process.env.MONGODB_URI); dbUp = true; } }
async function dbClose() { if (dbUp) { await mongoose.connection.close(); dbUp = false; } }
function M(n) { return require(`../models/${n}`); }

async function readOTP(email, modelName) {
  await db();
  const doc = await M(modelName).findOne({ email: email.toLowerCase().trim() }).select('otp');
  return doc?.otp;
}

// ─── Shared state ────────────────────────────────────────────────────
const state = {
  adminToken: null, adminId: null,
  sellerToken: null, sellerId: null, sellerSlug: null,
  customerToken: null, customerId: null,
  corpToken: null, corpUserId: null,
  productIds: [], productSlugs: [],
  categoryId: null,
  orderIds: [],
  reviewId: null,
  couponId: null,
  inquiryId: null,
  corpQuoteId: null, corpCatalogId: null,
};

// =====================================================================
// 1) ADMIN AUTH
// =====================================================================
async function testAdminAuth() {
  if (!shouldRun('admin-auth')) return;
  sec('1) Admin Auth');

  const email = process.env.ADMIN_EMAIL || 'burnt776@gmail.com';

  let r = await api(`${MAIN}/api/auth/send-otp`, { method: 'POST', body: { email } });
  ok(r.ok, 'Admin send-otp', `${r.status} ${JSON.stringify(r.data)}`);

  await db();
  const otp = await readOTP(email, 'Admin');
  if (!otp) { skp('Admin verify-otp', 'No OTP in Admin model'); return; }

  r = await api(`${MAIN}/api/auth/verify-otp`, { method: 'POST', body: { email, otp } });
  ok(r.ok, 'Admin verify-otp', `${r.status}`);
  ok(r.data.user?.userType === 'admin' || r.data.user?.role === 'admin', 'Admin role confirmed');
  state.adminToken = r.data.token;
  state.adminId = r.data.user?._id;

  r = await api(`${MAIN}/api/auth/me`, { headers: auth(state.adminToken) });
  ok(r.ok, 'Admin GET /me');
}

// =====================================================================
// 2) SELLER REGISTRATION + AUTH
// =====================================================================
async function testSellerRegistration() {
  if (!shouldRun('seller-reg')) return;
  sec('2) Seller Registration + Auth');

  const email = `testseller_${TS}@test.com`;
  const name = `TestSeller_${TS}`;

  let r = await api(`${MAIN}/api/auth/register-seller`, {
    method: 'POST',
    body: { email, name, phone: '9876543210', instagramUsername: 'testshop' }
  });
  ok(r.status === 201, 'Register seller 201', `${r.status} ${JSON.stringify(r.data)}`);
  state.sellerId = r.data.sellerId;

  // Read OTP from Seller model (register-seller sets it directly)
  const otp = await readOTP(email, 'Seller');
  if (!otp) { skp('Seller verify', 'No OTP'); return; }

  r = await api(`${MAIN}/api/auth/verify-otp`, { method: 'POST', body: { email, otp } });
  ok(r.ok, 'Seller verify-otp', `${r.status}`);
  ok(r.data.user?.userType === 'seller', 'Seller userType', `Got ${r.data.user?.userType}`);
  ok(r.data.user?.status === 'pending', 'Seller status is pending');
  state.sellerToken = r.data.token;
  state.sellerId = r.data.user?._id;

  // Read seller slug from DB
  await db();
  const seller = await M('Seller').findById(state.sellerId).select('sellerProfile.businessSlug').lean();
  state.sellerSlug = seller?.sellerProfile?.businessSlug;
}

// =====================================================================
// 3) ADMIN APPROVES SELLER
// =====================================================================
async function testAdminApprovesSeller() {
  if (!shouldRun('approve-seller')) return;
  sec('3) Admin Approves Seller');

  if (!state.adminToken || !state.sellerId) { skp('Approve seller', 'No admin token or seller ID'); return; }

  let r = await api(`${MAIN}/api/admin/sellers/${state.sellerId}/approve`, {
    method: 'PUT', headers: auth(state.adminToken)
  });
  ok(r.ok, 'Approve seller', `${r.status}`);

  r = await api(`${MAIN}/api/admin/sellers/${state.sellerId}`, { headers: auth(state.adminToken) });
  ok(r.ok, 'GET seller details');
  ok(r.data.seller?.status === 'active', 'Seller now active', `Got ${r.data.seller?.status}`);
}

// =====================================================================
// 4) CATEGORY MANAGEMENT
// =====================================================================
async function testCategoryManagement() {
  if (!shouldRun('categories')) return;
  sec('4) Category Management (Admin)');

  if (!state.adminToken) { skp('Categories', 'No admin token'); return; }

  let r = await api(`${MAIN}/api/admin/categories`, {
    method: 'POST', headers: auth(state.adminToken),
    body: { name: `TestCat_${TS}`, description: 'Test category', icon: 'gift', displayOrder: 99 }
  });
  ok(r.status === 201, 'Create category', `${r.status}`);
  state.categoryId = r.data.category?._id;

  r = await api(`${MAIN}/api/admin/categories`, { headers: auth(state.adminToken) });
  ok(r.ok, 'List categories');
  ok(r.data.categories?.some(c => c._id === state.categoryId), 'Test category found in list');

  r = await api(`${MAIN}/api/admin/categories/${state.categoryId}`, {
    method: 'PUT', headers: auth(state.adminToken),
    body: { description: 'Updated test category' }
  });
  ok(r.ok, 'Update category');
}

// =====================================================================
// 5) SELLER CREATES PRODUCTS
// =====================================================================
async function testSellerProducts() {
  if (!shouldRun('seller-products')) return;
  sec('5) Seller Creates Products');

  if (!state.sellerToken) { skp('Products', 'No seller token'); return; }

  const catName = state.categoryId ? `TestCat_${TS}` : 'Gifts';

  // Product 1 -- multipart form data (multer route)
  let r = await api(`${SELLER}/api/seller/products`, {
    method: 'POST', headers: auth(state.sellerToken),
    formData: { title: `TestProduct1_${TS}`, price: '500', stock: '100', category: catName, description: 'A test product' }
  });
  ok(r.status === 201, 'Create product 1', `${r.status} ${r.data.message || JSON.stringify(r.data).substring(0, 100)}`);
  if (r.data.product) {
    state.productIds.push(r.data.product._id);
    state.productSlugs.push(r.data.product.slug);
  }

  // Product 2
  r = await api(`${SELLER}/api/seller/products`, {
    method: 'POST', headers: auth(state.sellerToken),
    formData: { title: `TestProduct2_${TS}`, price: '1200', stock: '50', category: catName, description: 'Another test product' }
  });
  ok(r.status === 201, 'Create product 2', `${r.status}`);
  if (r.data.product) {
    state.productIds.push(r.data.product._id);
    state.productSlugs.push(r.data.product.slug);
  }

  // List products
  r = await api(`${SELLER}/api/seller/products`, { headers: auth(state.sellerToken) });
  ok(r.ok, 'Seller list products');
  ok(r.data.products?.length >= 2, `Seller has >= 2 products (${r.data.products?.length})`);

  // Update product 1 (also multer route)
  if (state.productIds[0]) {
    r = await api(`${SELLER}/api/seller/products/${state.productIds[0]}`, {
      method: 'PUT', headers: auth(state.sellerToken),
      formData: { description: 'Updated description', stock: '200' }
    });
    ok(r.ok, 'Update product 1');
  }

  // Verify slugs generated
  ok(state.productSlugs[0]?.length > 0, 'Product 1 has slug', state.productSlugs[0]);
}

// =====================================================================
// 6) PUBLIC BROWSING
// =====================================================================
async function testPublicBrowsing() {
  if (!shouldRun('browsing')) return;
  sec('6) Public Browsing');

  let r = await api(`${MAIN}/api/products`);
  ok(r.ok, 'GET /api/products');
  ok(Array.isArray(r.data.products), 'Products is array');

  r = await api(`${MAIN}/api/products/featured`);
  ok(r.ok, 'GET /api/products/featured');

  r = await api(`${MAIN}/api/products/categories`);
  ok(r.ok, 'GET /api/products/categories');
  ok(Array.isArray(r.data.categories), 'Categories is array');

  if (state.productSlugs[0]) {
    r = await api(`${MAIN}/api/products/${state.productSlugs[0]}`);
    ok(r.ok, `GET /api/products/${state.productSlugs[0]}`, `${r.status}`);
    ok(r.data.product?.title?.includes('TestProduct1'), 'Product detail correct');
  }

  r = await api(`${MAIN}/api/store/info`);
  ok(r.ok, 'GET /api/store/info');

  r = await api(`${MAIN}/api/store/sellers`);
  ok(r.ok, 'GET /api/store/sellers');

  r = await api(`${MAIN}/api/store/featured/top-sellers`);
  ok(r.ok, 'GET /api/store/featured/top-sellers');

  if (state.sellerSlug) {
    r = await api(`${MAIN}/api/store/${state.sellerSlug}`);
    ok(r.ok, `GET /api/store/${state.sellerSlug}`, `${r.status}`);

    r = await api(`${MAIN}/api/store/${state.sellerSlug}/products`);
    ok(r.ok, `GET /api/store/${state.sellerSlug}/products`);

    r = await api(`${MAIN}/api/store/${state.sellerSlug}/reviews`);
    ok(r.ok, `GET /api/store/${state.sellerSlug}/reviews`);
  }
}

// =====================================================================
// 7) CUSTOMER AUTH + PROFILE
// =====================================================================
async function testCustomerAuth() {
  if (!shouldRun('customer-auth')) return;
  sec('7) Customer Auth + Profile');

  const email = `testcustomer_${TS}@test.com`;

  let r = await api(`${MAIN}/api/auth/send-otp`, { method: 'POST', body: { email } });
  ok(r.ok, 'Customer send-otp');

  const otp = await readOTP(email, 'Customer');
  if (!otp) { skp('Customer verify', 'No OTP'); return; }

  r = await api(`${MAIN}/api/auth/verify-otp`, { method: 'POST', body: { email, otp } });
  ok(r.ok, 'Customer verify-otp');
  ok(r.data.user?.userType === 'customer', 'Customer userType');
  state.customerToken = r.data.token;
  state.customerId = r.data.user?._id;

  // Update profile
  r = await api(`${MAIN}/api/auth/profile`, {
    method: 'PUT', headers: auth(state.customerToken),
    body: { name: 'Test Customer', phone: '9999888877' }
  });
  ok(r.ok, 'Update profile');

  // Add shipping address
  r = await api(`${MAIN}/api/auth/addresses`, {
    method: 'PUT', headers: auth(state.customerToken),
    body: { addresses: [{ label: 'Home', name: 'Test Customer', phone: '9999888877', street: '123 Test St', city: 'Mumbai', state: 'MH', pincode: '400001', isDefault: true }] }
  });
  ok(r.ok, 'Update addresses');

  // GET /me
  r = await api(`${MAIN}/api/auth/me`, { headers: auth(state.customerToken) });
  ok(r.ok, 'Customer GET /me');
  ok(r.data.user?.name === 'Test Customer', 'Profile name correct');
  ok(r.data.user?.shippingAddresses?.length === 1, 'Address saved');
}

// =====================================================================
// 8) WISHLIST
// =====================================================================
async function testWishlist() {
  if (!shouldRun('wishlist')) return;
  sec('8) Wishlist');

  if (!state.customerToken || !state.productIds[0]) { skp('Wishlist', 'No customer token or product'); return; }

  let r = await api(`${MAIN}/api/wishlist`, {
    method: 'POST', headers: auth(state.customerToken),
    body: { productId: state.productIds[0] }
  });
  ok(r.status === 201 || r.ok, 'Add to wishlist', `${r.status}`);

  r = await api(`${MAIN}/api/wishlist`, { headers: auth(state.customerToken) });
  ok(r.ok, 'GET wishlist');
  ok(r.data.items?.length >= 1, 'Wishlist has items');

  r = await api(`${MAIN}/api/wishlist/ids`, { headers: auth(state.customerToken) });
  ok(r.ok, 'GET wishlist IDs');
  ok(r.data.productIds?.includes(state.productIds[0]), 'Product ID in wishlist');

  r = await api(`${MAIN}/api/wishlist/${state.productIds[0]}`, {
    method: 'DELETE', headers: auth(state.customerToken)
  });
  ok(r.ok, 'Remove from wishlist');
}

// =====================================================================
// 9) ORDER CREATION (DB bypass for Cashfree)
// =====================================================================
async function testOrderCreation() {
  if (!shouldRun('orders')) return;
  sec('9) Order Creation');

  if (!state.customerToken || !state.productIds[0] || !state.sellerId) {
    skp('Orders', 'Missing customer, product, or seller'); return;
  }

  // Attempt real order creation -- should fail at Cashfree
  let r = await api(`${MAIN}/api/orders`, {
    method: 'POST', headers: auth(state.customerToken),
    body: {
      items: [{ productId: state.productIds[0], quantity: 1 }],
      shippingAddress: { name: 'Test', phone: '9999888877', street: '123 St', city: 'Mumbai', state: 'MH', pincode: '400001' }
    }
  });
  ok(r.status === 500 || r.status === 400 || r.status === 201, 'Order attempt (Cashfree may fail)', `${r.status}`);

  // Direct DB insert: create 2 paid orders
  await db();
  const Order = M('Order');

  const orderBase = {
    orderType: 'b2c_marketplace',
    customerId: state.customerId,
    customerEmail: `testcustomer_${TS}@test.com`,
    customerPhone: '9999888877',
    sellerId: state.sellerId,
    shippingAddress: { name: 'Test', phone: '9999888877', street: '123 St', city: 'Mumbai', state: 'MH', pincode: '400001' },
    paymentStatus: 'paid',
    status: 'confirmed',
    paidAt: new Date(),
    commissionRate: 10,
    commissionAmount: 50,
    paymentGatewayFee: 10,
  };

  const order1 = await Order.create({
    ...orderBase,
    orderNumber: `GFT-TEST-${TS}-0001`,
    items: [{ productId: state.productIds[0], title: `TestProduct1_${TS}`, price: 500, quantity: 2, sellerId: state.sellerId }],
    itemTotal: 1000, shippingCost: 0, totalAmount: 1000, sellerAmount: 940,
  });
  state.orderIds.push(order1._id.toString());

  const order2 = await Order.create({
    ...orderBase,
    orderNumber: `GFT-TEST-${TS}-0002`,
    items: [{ productId: state.productIds[1] || state.productIds[0], title: `TestProduct2_${TS}`, price: 1200, quantity: 1, sellerId: state.sellerId }],
    itemTotal: 1200, shippingCost: 0, totalAmount: 1200, sellerAmount: 1080,
    status: 'confirmed',
  });
  state.orderIds.push(order2._id.toString());
  ok(true, 'Created 2 test orders via DB');

  // Verify customer can see orders
  r = await api(`${MAIN}/api/orders/my-orders`, { headers: auth(state.customerToken) });
  ok(r.ok, 'Customer GET /my-orders');
  ok(r.data.orders?.length >= 2, `Customer sees >= 2 orders (${r.data.orders?.length})`);

  // Get order detail
  r = await api(`${MAIN}/api/orders/${state.orderIds[0]}`, { headers: auth(state.customerToken) });
  ok(r.ok, 'GET order detail');
  ok(r.data.order?.orderNumber?.includes('TEST'), 'Order number correct');
}

// =====================================================================
// 10) SELLER ORDER MANAGEMENT
// =====================================================================
async function testSellerOrderManagement() {
  if (!shouldRun('seller-orders')) return;
  sec('10) Seller Order Management');

  if (!state.sellerToken || !state.orderIds[0]) { skp('Seller orders', 'No seller token or orders'); return; }

  // List seller orders
  let r = await api(`${SELLER}/api/seller/orders`, { headers: auth(state.sellerToken) });
  ok(r.ok, 'Seller GET /orders');
  ok(r.data.orders?.length >= 2, `Seller sees >= 2 orders (${r.data.orders?.length})`);

  // Ship order 1
  r = await api(`${SELLER}/api/seller/orders/${state.orderIds[0]}/ship`, {
    method: 'PUT', headers: auth(state.sellerToken),
    body: { courierName: 'TestCourier', trackingNumber: 'TRACK123', estimatedDelivery: new Date(Date.now() + 5 * 86400000).toISOString() }
  });
  ok(r.ok, 'Ship order 1', `${r.status} ${r.data.message}`);

  // Mark delivered
  r = await api(`${SELLER}/api/seller/orders/${state.orderIds[0]}/status`, {
    method: 'PUT', headers: auth(state.sellerToken),
    body: { status: 'delivered' }
  });
  ok(r.ok, 'Deliver order 1', `${r.status} ${r.data.message}`);
  ok(r.data.order?.status === 'delivered', 'Order 1 status is delivered');
}

// =====================================================================
// 11) CUSTOMER REVIEW
// =====================================================================
async function testCustomerReview() {
  if (!shouldRun('reviews')) return;
  sec('11) Customer Review');

  if (!state.customerToken || !state.productIds[0] || !state.orderIds[0]) {
    skp('Reviews', 'Missing state'); return;
  }

  let r = await api(`${MAIN}/api/reviews`, {
    method: 'POST', headers: auth(state.customerToken),
    body: { productId: state.productIds[0], orderId: state.orderIds[0], rating: 5, reviewText: 'Excellent product! Loved it.' }
  });
  ok(r.status === 201, 'Submit review', `${r.status} ${r.data.message || JSON.stringify(r.data).substring(0, 120)}`);
  state.reviewId = r.data.review?._id;

  // Get product reviews
  r = await api(`${MAIN}/api/reviews/product/${state.productIds[0]}`);
  ok(r.ok, 'GET product reviews');
  ok(r.data.reviews?.length >= 1, 'Review appears');

  // Admin hides review
  if (state.adminToken && state.reviewId) {
    r = await api(`${MAIN}/api/reviews/${state.reviewId}/hide`, {
      method: 'PUT', headers: auth(state.adminToken),
      body: { reason: 'Testing hide' }
    });
    ok(r.ok, 'Admin hide review');

    r = await api(`${MAIN}/api/reviews/product/${state.productIds[0]}`);
    ok(r.data.reviews?.every(rv => rv._id !== state.reviewId) || r.data.reviews?.length === 0, 'Hidden review not in list');

    // Unhide
    r = await api(`${MAIN}/api/reviews/${state.reviewId}/hide`, {
      method: 'PUT', headers: auth(state.adminToken), body: {}
    });
    ok(r.ok, 'Admin unhide review');
  }
}

// =====================================================================
// 12) ORDER CANCELLATION
// =====================================================================
async function testOrderCancellation() {
  if (!shouldRun('cancel-order')) return;
  sec('12) Order Cancellation');

  if (!state.customerToken || !state.orderIds[1]) { skp('Cancel order', 'No order'); return; }

  let r = await api(`${MAIN}/api/orders/${state.orderIds[1]}/cancel`, {
    method: 'POST', headers: auth(state.customerToken),
    body: { reason: 'Testing cancellation' }
  });
  ok(r.ok, 'Cancel order 2', `${r.status} ${r.data.message}`);

  r = await api(`${MAIN}/api/orders/${state.orderIds[1]}`, { headers: auth(state.customerToken) });
  ok(r.ok, 'GET cancelled order');
  ok(r.data.order?.status === 'cancelled', 'Order 2 status is cancelled');
}

// =====================================================================
// 13) COUPON CRUD + APPLY
// =====================================================================
async function testCoupons() {
  if (!shouldRun('coupons')) return;
  sec('13) Coupon CRUD + Apply');

  if (!state.adminToken) { skp('Coupons', 'No admin token'); return; }

  const code = `TEST${TS}`;

  // Admin creates coupon
  let r = await api(`${MAIN}/api/coupons`, {
    method: 'POST', headers: auth(state.adminToken),
    body: { code, description: 'Test coupon', type: 'percent', value: 15, maxDiscount: 200, usageLimit: 100, expiresAt: new Date(Date.now() + 86400000).toISOString() }
  });
  ok(r.status === 201, 'Create coupon', `${r.status}`);
  state.couponId = r.data.coupon?._id;

  // Admin lists coupons
  r = await api(`${MAIN}/api/coupons`, { headers: auth(state.adminToken) });
  ok(r.ok, 'Admin list coupons');
  ok(r.data.coupons?.some(c => c.code === code), 'Test coupon in list');

  // Customer applies coupon
  if (state.customerToken) {
    r = await api(`${MAIN}/api/coupons/apply`, {
      method: 'POST', headers: auth(state.customerToken),
      body: { code, orderTotal: 1000 }
    });
    ok(r.ok, 'Customer apply coupon', `${r.status}`);
    ok(r.data.valid === true, 'Coupon valid');
    ok(r.data.discount === 150, `Discount = 150 (15% of 1000)`, `Got ${r.data.discount}`);
  }

  // Admin updates coupon
  if (state.couponId) {
    r = await api(`${MAIN}/api/coupons/${state.couponId}`, {
      method: 'PUT', headers: auth(state.adminToken),
      body: { description: 'Updated test coupon' }
    });
    ok(r.ok, 'Update coupon');
  }
}

// =====================================================================
// 14) ADMIN DASHBOARD + ANALYTICS
// =====================================================================
async function testAdminDashboard() {
  if (!shouldRun('admin-dashboard')) return;
  sec('14) Admin Dashboard + Analytics');

  if (!state.adminToken) { skp('Admin dashboard', 'No admin token'); return; }

  let r = await api(`${MAIN}/api/admin/dashboard`, { headers: auth(state.adminToken) });
  ok(r.ok, 'GET /admin/dashboard');
  ok(r.data.stats?.totalSellers >= 1, `totalSellers >= 1 (${r.data.stats?.totalSellers})`);
  ok(r.data.stats?.totalProducts >= 2, `totalProducts >= 2 (${r.data.stats?.totalProducts})`);

  r = await api(`${MAIN}/api/admin/customers`, { headers: auth(state.adminToken) });
  ok(r.ok, 'GET /admin/customers');
  ok(Array.isArray(r.data.customers), 'Customers is array');

  r = await api(`${MAIN}/api/admin/sellers`, { headers: auth(state.adminToken) });
  ok(r.ok, 'GET /admin/sellers');

  r = await api(`${MAIN}/api/admin/products`, { headers: auth(state.adminToken) });
  ok(r.ok, 'GET /admin/products');

  r = await api(`${MAIN}/api/admin/orders`, { headers: auth(state.adminToken) });
  ok(r.ok, 'GET /admin/orders');

  r = await api(`${MAIN}/api/admin/users`, { headers: auth(state.adminToken) });
  ok(r.ok, 'GET /admin/users');

  if (state.sellerId) {
    r = await api(`${MAIN}/api/admin/sellers/${state.sellerId}/health`, { headers: auth(state.adminToken) });
    ok(r.ok, 'GET seller health metrics');
  }

  r = await api(`${MAIN}/api/admin/settings`, { headers: auth(state.adminToken) });
  ok(r.ok, 'GET /admin/settings');

  // Update settings (non-destructive: just update tagline)
  r = await api(`${MAIN}/api/admin/settings`, {
    method: 'PUT', headers: auth(state.adminToken),
    body: { tagline: 'Test tagline' }
  });
  ok(r.ok, 'PUT /admin/settings');

  // Payouts
  r = await api(`${MAIN}/api/admin/payouts`, { headers: auth(state.adminToken) });
  ok(r.ok, 'GET /admin/payouts');
}

// =====================================================================
// 15) SELLER COMMISSION + SUSPENSION
// =====================================================================
async function testSellerCommissionSuspension() {
  if (!shouldRun('seller-suspend')) return;
  sec('15) Seller Commission + Suspension');

  if (!state.adminToken || !state.sellerId || !state.sellerToken) {
    skp('Commission/Suspend', 'Missing state'); return;
  }

  // Set custom commission
  let r = await api(`${MAIN}/api/admin/sellers/${state.sellerId}/commission`, {
    method: 'PUT', headers: auth(state.adminToken),
    body: { commissionRate: 12 }
  });
  ok(r.ok, 'Set commission to 12%');

  // Suspend seller
  r = await api(`${MAIN}/api/admin/sellers/${state.sellerId}/suspend`, {
    method: 'PUT', headers: auth(state.adminToken),
    body: { reason: 'Test suspension' }
  });
  ok(r.ok, 'Suspend seller');

  // Verify products deactivated
  await db();
  const Product = M('Product');
  const activeCount = await Product.countDocuments({ sellerId: state.sellerId, isActive: true });
  ok(activeCount === 0, 'All seller products deactivated', `${activeCount} still active`);

  // Seller requests unsuspend
  r = await api(`${SELLER}/api/seller/request-unsuspend`, {
    method: 'POST', headers: auth(state.sellerToken),
    body: { reason: 'I promise to improve my quality and service standards.' }
  });
  ok(r.ok, 'Seller request unsuspend', `${r.status} ${r.data.message}`);

  // Admin unsuspends
  r = await api(`${MAIN}/api/admin/sellers/${state.sellerId}/approve`, {
    method: 'PUT', headers: auth(state.adminToken)
  });
  ok(r.ok, 'Admin unsuspend seller');

  // Verify products reactivated
  const activeAfter = await Product.countDocuments({ sellerId: state.sellerId, isActive: true });
  ok(activeAfter >= 2, 'Products reactivated', `${activeAfter} active`);

  // Seller settings
  r = await api(`${SELLER}/api/seller/settings`, { headers: auth(state.sellerToken) });
  ok(r.ok, 'Seller GET /settings');

  r = await api(`${SELLER}/api/seller/marketing`, { headers: auth(state.sellerToken) });
  ok(r.ok, 'Seller GET /marketing');
}

// =====================================================================
// 16) B2B INQUIRY FLOW
// =====================================================================
async function testB2BInquiry() {
  if (!shouldRun('b2b')) return;
  sec('16) B2B Inquiry Flow');

  // Submit inquiry (no auth)
  let r = await api(`${MAIN}/api/b2b/inquiries`, {
    method: 'POST',
    body: { companyName: 'TestCorp', contactPerson: 'John', email: 'john@testcorp.com', phone: '9876543210', numberOfEmployees: 75, budgetPerGift: '500-1000', quantityNeeded: 50, occasion: 'Diwali', specialRequirements: 'Custom packaging' }
  });
  ok(r.status === 201, 'Submit B2B inquiry', `${r.status}`);
  state.inquiryId = r.data.inquiry?._id;

  if (!state.adminToken) { skp('B2B admin ops', 'No admin token'); return; }

  // Admin lists inquiries
  r = await api(`${MAIN}/api/b2b/inquiries`, { headers: auth(state.adminToken) });
  ok(r.ok, 'Admin list inquiries');
  ok(r.data.inquiries?.length >= 1, 'Inquiry in list');

  // Admin gets detail
  if (state.inquiryId) {
    r = await api(`${MAIN}/api/b2b/inquiries/${state.inquiryId}`, { headers: auth(state.adminToken) });
    ok(r.ok, 'Admin get inquiry detail');

    // Admin updates
    r = await api(`${MAIN}/api/b2b/inquiries/${state.inquiryId}`, {
      method: 'PUT', headers: auth(state.adminToken),
      body: { status: 'contacted', adminNotes: 'Discussed requirements', quotedAmount: 25000 }
    });
    ok(r.ok, 'Admin update inquiry');
    ok(r.data.inquiry?.status === 'contacted', 'Inquiry status updated');
  }
}

// =====================================================================
// 17) CORPORATE FLOW
// =====================================================================
async function testCorporateFlow() {
  if (!shouldRun('corporate')) return;
  if (skipCorporate) { sec('17) Corporate Flow -- SKIPPED'); return; }
  sec('17) Corporate Flow');

  // Check corporate server is reachable
  try {
    const r = await api(`${CORPORATE}/api/corporate/health`);
    if (r.status >= 500) { skp('Corporate flow', 'Server error'); return; }
  } catch { skp('Corporate flow', 'Corporate server not reachable'); return; }

  // Submit inquiry
  let r = await api(`${CORPORATE}/api/corporate/inquiries`, {
    method: 'POST',
    body: { companyName: 'TestCorp Inc', contactPerson: 'Jane', email: 'jane@testcorp.com', phone: '9876543211' }
  });
  ok(r.status === 201 || r.ok, 'Submit corporate inquiry', `${r.status}`);

  // Create corporate user via DB (registration is done via send-otp with corporate email)
  await db();
  const CorporateUser = M('CorporateUser');
  let corpUser = await CorporateUser.findOne({ email: `testcorp_${TS}@testcorp.com` });
  if (!corpUser) {
    corpUser = await CorporateUser.create({
      email: `testcorp_${TS}@testcorp.com`,
      companyName: 'TestCorp Inc',
      contactPerson: 'Jane Doe',
      phone: '9876543211',
      status: 'pending_approval'
    });
  }
  state.corpUserId = corpUser._id.toString();

  // Admin approves corporate user
  if (state.adminToken) {
    r = await api(`${MAIN}/api/admin/corporate/users/${state.corpUserId}/approve`, {
      method: 'PUT', headers: auth(state.adminToken)
    });
    ok(r.ok, 'Admin approve corporate user', `${r.status}`);
  }

  // Corporate auth
  r = await api(`${CORPORATE}/api/corporate/auth/send-otp`, {
    method: 'POST', body: { email: `testcorp_${TS}@testcorp.com` }
  });
  ok(r.ok, 'Corporate send-otp', `${r.status} ${r.data.message}`);

  const corpOtp = await readOTP(`testcorp_${TS}@testcorp.com`, 'CorporateUser');
  if (!corpOtp) { skp('Corporate auth', 'No OTP'); return; }

  r = await api(`${CORPORATE}/api/corporate/auth/verify-otp`, {
    method: 'POST', body: { email: `testcorp_${TS}@testcorp.com`, otp: corpOtp }
  });
  ok(r.ok, 'Corporate verify-otp', `${r.status}`);
  state.corpToken = r.data.token;

  if (!state.corpToken) { skp('Corporate API tests', 'No token'); return; }

  // Corporate profile
  r = await api(`${CORPORATE}/api/corporate/auth/me`, { headers: auth(state.corpToken) });
  ok(r.ok, 'Corporate GET /me');

  r = await api(`${CORPORATE}/api/corporate/auth/profile`, {
    method: 'PUT', headers: auth(state.corpToken),
    body: { contactPerson: 'Jane Doe Updated', designation: 'CTO' }
  });
  ok(r.ok, 'Corporate update profile');

  // Browse catalog (may be empty)
  r = await api(`${CORPORATE}/api/corporate/catalog`, { headers: auth(state.corpToken) });
  ok(r.ok, 'Corporate GET /catalog');

  // Admin adds product to corporate catalog
  if (state.adminToken && state.productIds[0]) {
    r = await api(`${MAIN}/api/admin/corporate/catalog`, {
      method: 'POST', headers: auth(state.adminToken),
      body: { productId: state.productIds[0], corporatePrice: 450, minOrderQty: 5, maxOrderQty: 500 }
    });
    ok(r.status === 201, 'Admin add to corporate catalog', `${r.status}`);
    state.corpCatalogId = r.data.entry?._id;

    // Admin creates quote
    r = await api(`${MAIN}/api/admin/corporate/quotes`, {
      method: 'POST', headers: auth(state.adminToken),
      body: {
        companyName: 'TestCorp Inc', contactEmail: `testcorp_${TS}@testcorp.com`, corporateUserId: state.corpUserId,
        items: [{ productId: state.productIds[0], unitPrice: 450, quantity: 10 }],
        discountPercent: 5, validUntil: new Date(Date.now() + 30 * 86400000).toISOString()
      }
    });
    ok(r.status === 201, 'Admin create quote', `${r.status}`);
    state.corpQuoteId = r.data.quote?._id;
  }

  // Corporate views quotes
  r = await api(`${CORPORATE}/api/corporate/quotes`, { headers: auth(state.corpToken) });
  ok(r.ok, 'Corporate GET /quotes');

  // Corporate rejects quote
  if (state.corpQuoteId) {
    r = await api(`${CORPORATE}/api/corporate/quotes/${state.corpQuoteId}/reject`, {
      method: 'POST', headers: auth(state.corpToken),
      body: { reason: 'Testing rejection' }
    });
    ok(r.ok, 'Corporate reject quote', `${r.status}`);
  }

  // Corporate orders (may be empty)
  r = await api(`${CORPORATE}/api/corporate/orders`, { headers: auth(state.corpToken) });
  ok(r.ok, 'Corporate GET /orders');

  // Admin suspends corporate user
  if (state.adminToken) {
    r = await api(`${MAIN}/api/admin/corporate/users/${state.corpUserId}/suspend`, {
      method: 'PUT', headers: auth(state.adminToken),
      body: { reason: 'Test suspension' }
    });
    ok(r.ok, 'Admin suspend corporate user');
  }
}

// =====================================================================
// 18) ADMIN CRON
// =====================================================================
async function testAdminCron() {
  if (!shouldRun('cron')) return;
  sec('18) Admin Cron');

  if (!state.adminToken) { skp('Cron', 'No admin token'); return; }

  let r = await api(`${MAIN}/api/admin/cron/run`, {
    method: 'POST', headers: auth(state.adminToken)
  });
  ok(r.ok, 'Trigger cron manually', `${r.status} ${r.data.message}`);
}

// =====================================================================
// 19) LOG VERIFICATION
// =====================================================================
async function testLogVerification() {
  if (!shouldRun('logs')) return;
  sec('19) Log Verification');

  await db();
  const ActivityLog = M('ActivityLog');
  const NotificationLog = M('NotificationLog');
  const AuthSession = M('AuthSession');
  const OtpLog = M('OtpLog');
  const AuthAuditLog = M('AuthAuditLog');

  const actCount = await ActivityLog.countDocuments();
  ok(actCount > 0, `ActivityLog has records (${actCount})`);

  const notifCount = await NotificationLog.countDocuments();
  ok(notifCount > 0, `NotificationLog has records (${notifCount})`);

  const sessCount = await AuthSession.countDocuments();
  ok(sessCount > 0, `AuthSession has records (${sessCount})`);

  const otpCount = await OtpLog.countDocuments();
  ok(otpCount > 0, `OtpLog has records (${otpCount})`);

  const auditCount = await AuthAuditLog.countDocuments();
  ok(auditCount > 0, `AuthAuditLog has records (${auditCount})`);

  console.log(`  i Totals: Activity=${actCount} Notif=${notifCount} Session=${sessCount} OTP=${otpCount} Audit=${auditCount}`);
}

// =====================================================================
// 20) CLEANUP
// =====================================================================
async function cleanup() {
  sec('20) Cleanup');
  await db();

  const Order = M('Order');
  const Product = M('Product');
  const Review = M('Review');
  const Wishlist = M('Wishlist');
  const Coupon = M('Coupon');
  const Category = M('Category');
  const Customer = M('Customer');
  const Seller = M('Seller');
  const B2BInquiry = M('B2BInquiry');
  const CorporateUser = M('CorporateUser');
  const CorporateQuote = M('CorporateQuote');
  const CorporateCatalog = M('CorporateCatalog');
  const ActivityLog = M('ActivityLog');
  const NotificationLog = M('NotificationLog');
  const AuthSession = M('AuthSession');
  const OtpLog = M('OtpLog');
  const AuthAuditLog = M('AuthAuditLog');

  let cleaned = [];

  // Delete test orders
  if (state.orderIds.length) {
    await Order.deleteMany({ _id: { $in: state.orderIds } });
    cleaned.push(`${state.orderIds.length} orders`);
  }

  // Delete test review
  if (state.reviewId) { await Review.deleteOne({ _id: state.reviewId }); cleaned.push('review'); }

  // Delete test products
  if (state.productIds.length) {
    await Product.deleteMany({ _id: { $in: state.productIds } });
    cleaned.push(`${state.productIds.length} products`);
  }

  // Delete test coupon
  if (state.couponId) { await Coupon.deleteOne({ _id: state.couponId }); cleaned.push('coupon'); }

  // Delete test category
  if (state.categoryId) { await Category.deleteOne({ _id: state.categoryId }); cleaned.push('category'); }

  // Delete test wishlist items
  if (state.customerId) { await Wishlist.deleteMany({ userId: state.customerId }); }

  // Delete test inquiry
  if (state.inquiryId) { await B2BInquiry.deleteOne({ _id: state.inquiryId }); cleaned.push('b2b inquiry'); }

  // Delete corporate test data
  if (state.corpQuoteId) { await CorporateQuote.deleteOne({ _id: state.corpQuoteId }); cleaned.push('corp quote'); }
  if (state.corpCatalogId) { await CorporateCatalog.deleteOne({ _id: state.corpCatalogId }); cleaned.push('corp catalog'); }
  if (state.corpUserId) { await CorporateUser.deleteOne({ _id: state.corpUserId }); cleaned.push('corp user'); }

  // Delete test customer
  if (state.customerId) { await Customer.deleteOne({ _id: state.customerId }); cleaned.push('customer'); }

  // Delete test seller
  if (state.sellerId) { await Seller.deleteOne({ _id: state.sellerId }); cleaned.push('seller'); }

  // Clean up logs from test actions (optional -- only test-related)
  // We don't delete logs as they're operational records

  console.log(`  i Cleaned: ${cleaned.join(', ')}`);
}

// =====================================================================
// MAIN
// =====================================================================
async function main() {
  console.log('================================================================');
  console.log('   Full App Flow -- End-to-End API Integration Test');
  console.log('================================================================');
  console.log(`Servers: Main=${MAIN}  Seller=${SELLER}  Corporate=${CORPORATE}`);
  if (sectionFilter) console.log(`Section filter: ${sectionFilter}`);
  if (skipCorporate) console.log('Skipping corporate tests');
  console.log('');

  // Check main server
  try { await fetch(`${MAIN}/api/health`); }
  catch {
    console.error('ERROR: Main server not reachable at ' + MAIN);
    console.error('Start servers: npm run dev');
    process.exit(1);
  }

  try {
    await testAdminAuth();
    await testSellerRegistration();
    await testAdminApprovesSeller();
    await testCategoryManagement();
    await testSellerProducts();
    await testPublicBrowsing();
    await testCustomerAuth();
    await testWishlist();
    await testOrderCreation();
    await testSellerOrderManagement();
    await testCustomerReview();
    await testOrderCancellation();
    await testCoupons();
    await testAdminDashboard();
    await testSellerCommissionSuspension();
    await testB2BInquiry();
    await testCorporateFlow();
    await testAdminCron();
    await testLogVerification();
  } catch (err) {
    console.error('\nFATAL ERROR:', err);
  }

  // Cleanup
  try { await cleanup(); } catch (err) { console.error('Cleanup error:', err.message); }
  await dbClose();

  // Summary
  console.log('\n================================================================');
  console.log(`   Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log('================================================================');

  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(f));
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
