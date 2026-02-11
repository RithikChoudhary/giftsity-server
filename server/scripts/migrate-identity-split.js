/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Seller = require('../models/Seller');
const Admin = require('../models/Admin');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Review = require('../models/Review');
const SellerPayout = require('../models/SellerPayout');
const Shipment = require('../models/Shipment');
const Coupon = require('../models/Coupon');
const Wishlist = require('../models/Wishlist');
const B2BInquiry = require('../models/B2BInquiry');
const CorporateQuote = require('../models/CorporateQuote');
const CorporateCatalog = require('../models/CorporateCatalog');
const PlatformSettings = require('../models/PlatformSettings');
const CorporateUser = require('../models/CorporateUser');
const AuthSession = require('../models/AuthSession');
const AuthAuditLog = require('../models/AuthAuditLog');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || !args.includes('--execute');

function toPlain(doc) {
  if (!doc) return null;
  return doc.toObject ? doc.toObject() : doc;
}

async function migrateUsers() {
  const report = {
    mode: isDryRun ? 'dry-run' : 'execute',
    legacyCount: 0,
    migrated: { customers: 0, sellers: 0, admins: 0 },
    skipped: { customers: 0, sellers: 0, admins: 0 },
    collisions: [],
    errors: [],
    unhandled: [],
    orphanChecks: {},
    summary: { totalProcessed: 0, totalErrors: 0, totalSkipped: 0, totalCollisions: 0, totalMigrated: 0 }
  };

  const users = await User.find();
  report.legacyCount = users.length;

  for (const legacyUser of users) {
    report.summary.totalProcessed += 1;

    try {
      const u = toPlain(legacyUser);
      // Normalize phone: strip leading 0 or +91, keep 10 digits
      let phone = (u.phone || '').replace(/\D/g, '');
      if (phone.length === 11 && phone.startsWith('0')) phone = phone.slice(1);
      if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
      if (phone.length === 13 && phone.startsWith('091')) phone = phone.slice(3);

      const common = {
        _id: u._id,
        email: u.email,
        name: u.name || '',
        phone,
        otp: u.otp || null,
        otpExpiry: u.otpExpiry || null,
        legacyUserId: u._id,
        createdAt: u.createdAt || new Date(),
        updatedAt: u.updatedAt || new Date()
      };

      if (u.userType === 'customer') {
        const payload = {
          ...common,
          status: u.status === 'suspended' ? 'suspended' : 'active',
          shippingAddresses: u.shippingAddresses || [],
          isProfileComplete: u.isProfileComplete || false
        };
        const existing = await Customer.findById(u._id).lean();
        if (existing) {
          report.skipped.customers += 1;
          report.summary.totalSkipped += 1;
        } else {
          const emailCollision = await Customer.findOne({ email: u.email }).lean();
          if (emailCollision && String(emailCollision._id) !== String(u._id)) {
            report.collisions.push({ role: 'customer', email: u.email, legacyId: String(u._id), existingId: String(emailCollision._id) });
            report.summary.totalCollisions += 1;
            continue;
          }
          report.migrated.customers += 1;
          report.summary.totalMigrated += 1;
          if (!isDryRun) await Customer.create(payload);
        }
      } else if (u.userType === 'seller') {
        const payload = {
          ...common,
          status: u.status || 'pending',
          sellerProfile: u.sellerProfile || {},
          isProfileComplete: u.isProfileComplete !== undefined ? u.isProfileComplete : true
        };
        const existing = await Seller.findById(u._id).lean();
        if (existing) {
          report.skipped.sellers += 1;
          report.summary.totalSkipped += 1;
        } else {
          const emailCollision = await Seller.findOne({ email: u.email }).lean();
          if (emailCollision && String(emailCollision._id) !== String(u._id)) {
            report.collisions.push({ role: 'seller', email: u.email, legacyId: String(u._id), existingId: String(emailCollision._id) });
            report.summary.totalCollisions += 1;
            continue;
          }
          report.migrated.sellers += 1;
          report.summary.totalMigrated += 1;
          if (!isDryRun) await Seller.create(payload);
        }
      } else if (u.userType === 'admin') {
        const payload = {
          ...common,
          status: u.status === 'suspended' ? 'suspended' : 'active',
          role: 'admin'
        };
        const existing = await Admin.findById(u._id).lean();
        if (existing) {
          report.skipped.admins += 1;
          report.summary.totalSkipped += 1;
        } else {
          const emailCollision = await Admin.findOne({ email: u.email }).lean();
          if (emailCollision && String(emailCollision._id) !== String(u._id)) {
            report.collisions.push({ role: 'admin', email: u.email, legacyId: String(u._id), existingId: String(emailCollision._id) });
            report.summary.totalCollisions += 1;
            continue;
          }
          report.migrated.admins += 1;
          report.summary.totalMigrated += 1;
          if (!isDryRun) await Admin.create(payload);
        }
      } else {
        // Missing or invalid userType
        report.unhandled.push({
          legacyId: String(legacyUser._id),
          email: legacyUser.email,
          userType: u.userType || '<missing>',
          reason: `Unknown or missing userType: "${u.userType || ''}"`
        });
      }
    } catch (err) {
      report.errors.push({
        legacyId: String(legacyUser._id),
        email: legacyUser.email,
        error: err.message
      });
      report.summary.totalErrors += 1;
      // Continue processing remaining users
    }
  }

  return report;
}

async function runIntegrityChecks() {
  const checks = {};

  const [
    allOrders,
    allProducts,
    allReviews,
    allPayouts,
    allShipments,
    allCoupons,
    allWishlists,
    allB2BInquiries,
    allCorporateQuotes,
    allCorporateCatalog,
    allCorporateUsers,
    allAuthSessions,
    allAuthAuditLogs
  ] = await Promise.all([
    Order.find().select('_id customerId sellerId items.sellerId').lean(),
    Product.find().select('_id sellerId').lean(),
    Review.find().select('_id sellerId customerId').lean(),
    SellerPayout.find().select('_id sellerId paidBy').lean(),
    Shipment.find().select('_id sellerId').lean(),
    Coupon.find().select('_id usedBy').lean(),
    Wishlist.find().select('_id userId').lean(),
    B2BInquiry.find().select('_id activityLog').lean(),
    CorporateQuote.find().select('_id createdBy').lean(),
    CorporateCatalog.find().select('_id addedBy').lean(),
    CorporateUser.find().select('_id approvedBy').lean(),
    AuthSession.find().select('_id userId userRole').lean(),
    AuthAuditLog.find().select('_id userId role').lean()
  ]);

  const [customerIds, sellerIds, adminIds] = await Promise.all([
    Customer.find().select('_id').lean(),
    Seller.find().select('_id').lean(),
    Admin.find().select('_id').lean()
  ]);

  const customerSet = new Set(customerIds.map(d => String(d._id)));
  const sellerSet = new Set(sellerIds.map(d => String(d._id)));
  const adminSet = new Set(adminIds.map(d => String(d._id)));
  const allIdentitySet = new Set([...customerSet, ...sellerSet, ...adminSet]);

  // Existing checks
  checks.ordersMissingCustomer = allOrders.filter(o => o.customerId && !customerSet.has(String(o.customerId))).length;
  checks.ordersMissingSeller = allOrders.filter(o => o.sellerId && !sellerSet.has(String(o.sellerId))).length;
  checks.orderItemsMissingSeller = allOrders.reduce((sum, o) => sum + (o.items || []).filter(i => i.sellerId && !sellerSet.has(String(i.sellerId))).length, 0);
  checks.productsMissingSeller = allProducts.filter(p => p.sellerId && !sellerSet.has(String(p.sellerId))).length;
  checks.reviewsMissingSeller = allReviews.filter(r => r.sellerId && !sellerSet.has(String(r.sellerId))).length;
  checks.reviewsMissingCustomer = allReviews.filter(r => r.customerId && !customerSet.has(String(r.customerId))).length;
  checks.payoutsMissingSeller = allPayouts.filter(p => p.sellerId && !sellerSet.has(String(p.sellerId))).length;
  checks.payoutsMissingAdmin = allPayouts.filter(p => p.paidBy && !adminSet.has(String(p.paidBy))).length;
  checks.shipmentsMissingSeller = allShipments.filter(s => s.sellerId && !sellerSet.has(String(s.sellerId))).length;
  checks.couponsMissingCustomerRefs = allCoupons.reduce((sum, c) => sum + (c.usedBy || []).filter(id => !customerSet.has(String(id))).length, 0);

  // New checks
  checks.wishlistsMissingCustomer = allWishlists.filter(w => w.userId && !customerSet.has(String(w.userId))).length;
  checks.b2bInquiriesMissingAdmin = allB2BInquiries.reduce((sum, inq) => {
    return sum + (inq.activityLog || []).filter(entry => entry.by && !adminSet.has(String(entry.by))).length;
  }, 0);
  checks.corporateQuotesMissingAdmin = allCorporateQuotes.filter(q => q.createdBy && !adminSet.has(String(q.createdBy))).length;
  checks.corporateCatalogMissingAdmin = allCorporateCatalog.filter(c => c.addedBy && !adminSet.has(String(c.addedBy))).length;
  checks.corporateUsersMissingApprover = allCorporateUsers.filter(u => u.approvedBy && !adminSet.has(String(u.approvedBy))).length;
  checks.authSessionsMissingUser = allAuthSessions.filter(s => {
    if (!s.userId) return false;
    const id = String(s.userId);
    return !allIdentitySet.has(id);
  }).length;
  checks.authAuditLogsMissingUser = allAuthAuditLogs.filter(a => {
    if (!a.userId) return false;
    const id = String(a.userId);
    return !allIdentitySet.has(id);
  }).length;

  // Check PlatformSettings
  try {
    const settings = await PlatformSettings.findOne().select('updatedBy').lean();
    checks.platformSettingsMissingAdmin = (settings && settings.updatedBy && !adminSet.has(String(settings.updatedBy))) ? 1 : 0;
  } catch {
    checks.platformSettingsMissingAdmin = 0;
  }

  return checks;
}

async function main() {
  console.log(`[Identity Migration] Starting in ${isDryRun ? 'DRY-RUN' : 'EXECUTE'} mode...`);
  await connectDB();

  const report = await migrateUsers();
  report.orphanChecks = await runIntegrityChecks();

  console.log('\n[Identity Migration] Report:');
  console.log(JSON.stringify(report, null, 2));

  // Print summary
  console.log('\n--- SUMMARY ---');
  console.log(`Mode: ${report.mode}`);
  console.log(`Legacy users found: ${report.legacyCount}`);
  console.log(`Total processed: ${report.summary.totalProcessed}`);
  console.log(`Total migrated: ${report.summary.totalMigrated} (customers: ${report.migrated.customers}, sellers: ${report.migrated.sellers}, admins: ${report.migrated.admins})`);
  console.log(`Total skipped (already exist): ${report.summary.totalSkipped}`);
  console.log(`Total collisions: ${report.summary.totalCollisions}`);
  console.log(`Total errors: ${report.summary.totalErrors}`);
  console.log(`Unhandled (missing/invalid userType): ${report.unhandled.length}`);

  // Print orphan check summary
  const orphanTotal = Object.values(report.orphanChecks).reduce((s, v) => s + v, 0);
  console.log(`\nOrphan reference checks: ${orphanTotal === 0 ? 'ALL CLEAN' : `${orphanTotal} orphan(s) found`}`);
  for (const [key, val] of Object.entries(report.orphanChecks)) {
    if (val > 0) console.log(`  - ${key}: ${val}`);
  }

  if (!isDryRun) {
    console.log('\n[Identity Migration] Completed.');
  } else {
    console.log('\n[Identity Migration] Dry-run completed. Run with --execute to apply changes.');
  }

  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error('[Identity Migration] Failed:', err);
  try { await mongoose.connection.close(); } catch (_) {}
  process.exit(1);
});
