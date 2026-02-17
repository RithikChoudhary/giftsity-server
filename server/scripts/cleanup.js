/**
 * Database Cleanup Script
 * Wipes all demo/test data while preserving:
 *   - Admin user accounts (User where userType === 'admin')
 *   - PlatformSettings collection
 *   - Category collection
 *
 * Usage: node server/scripts/cleanup.js
 * Requires MONGODB_URI in .env
 */
require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI not found in .env');
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  console.log('\n=== Giftsity Database Cleanup ===\n');
  console.log(`Connecting to: ${MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}`);

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  console.log('Connected.\n');

  // Collections to wipe completely (all documents)
  const collectionsToWipe = [
    'sellers',
    'customers',
    'products',
    'orders',
    'reviews',
    'wishlists',
    'conversations',
    'messages',
    'notifications',
    'notificationlogs',
    'returnrequests',
    'sellerpayouts',
    'shipments',
    'activitylogs',
    'authauditlogs',
    'authsessions',
    'otplogs',
    'coupons',
    'b2binquiries',
    'corporateusers',
    'corporatecatalogs',
    'corporatequotes',
  ];

  // Counts
  console.log('Current document counts:');
  console.log('─'.repeat(45));

  const adminCount = await db.collection('users').countDocuments({ userType: 'admin' });
  const nonAdminCount = await db.collection('users').countDocuments({ userType: { $ne: 'admin' } });
  console.log(`  users (admin, KEEP):          ${adminCount}`);
  console.log(`  users (non-admin, DELETE):     ${nonAdminCount}`);

  for (const col of collectionsToWipe) {
    try {
      const count = await db.collection(col).countDocuments();
      console.log(`  ${col.padEnd(33)} ${count}`);
    } catch {
      console.log(`  ${col.padEnd(33)} (collection not found)`);
    }
  }

  const settingsCount = await db.collection('platformsettings').countDocuments();
  const categoryCount = await db.collection('categories').countDocuments();
  console.log('─'.repeat(45));
  console.log(`  platformsettings (KEEP):       ${settingsCount}`);
  console.log(`  categories (KEEP):             ${categoryCount}`);
  console.log('');

  const answer = await ask('⚠️  This will DELETE all data listed above (except admin, settings, categories).\nType "YES" to confirm: ');
  if (answer.trim() !== 'YES') {
    console.log('Aborted.');
    rl.close();
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log('\nDeleting...\n');

  // 1. Delete non-admin users
  const userResult = await db.collection('users').deleteMany({ userType: { $ne: 'admin' } });
  console.log(`  users (non-admin): ${userResult.deletedCount} deleted`);

  // 2. Wipe all other collections
  for (const col of collectionsToWipe) {
    try {
      const result = await db.collection(col).deleteMany({});
      console.log(`  ${col}: ${result.deletedCount} deleted`);
    } catch {
      console.log(`  ${col}: skipped (not found)`);
    }
  }

  console.log('\n=== Cleanup Complete ===');
  console.log(`Preserved: ${adminCount} admin user(s), ${settingsCount} platform settings, ${categoryCount} categories.\n`);

  rl.close();
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
