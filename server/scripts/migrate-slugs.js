/**
 * One-time migration: regenerate businessSlug from businessName for all sellers.
 * Old slugs are preserved in oldSlugs array for backward compatibility.
 *
 * Usage: node server/scripts/migrate-slugs.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Seller = require('../models/Seller');
const { slugifyClean } = require('../utils/slugify');

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const sellers = await Seller.find({ 'sellerProfile.businessSlug': { $ne: '' } });
  console.log(`Found ${sellers.length} sellers to migrate`);

  const usedSlugs = new Set();

  for (const seller of sellers) {
    const oldSlug = seller.sellerProfile.businessSlug;
    const businessName = seller.sellerProfile.businessName;

    if (!businessName) {
      console.log(`  SKIP ${seller.email} — no businessName`);
      continue;
    }

    let newSlug = slugifyClean(businessName);
    if (!newSlug) {
      console.log(`  SKIP ${seller.email} — businessName "${businessName}" produces empty slug`);
      continue;
    }

    // Handle collisions within this batch
    let candidate = newSlug;
    let counter = 1;
    while (usedSlugs.has(candidate)) {
      counter++;
      candidate = `${newSlug}-${counter}`;
    }
    newSlug = candidate;

    if (oldSlug === newSlug) {
      console.log(`  OK   ${seller.email} — slug already clean: ${newSlug}`);
      usedSlugs.add(newSlug);
      continue;
    }

    // Preserve old slug
    if (!seller.sellerProfile.oldSlugs) seller.sellerProfile.oldSlugs = [];
    if (oldSlug && !seller.sellerProfile.oldSlugs.includes(oldSlug)) {
      seller.sellerProfile.oldSlugs.push(oldSlug);
    }

    seller.sellerProfile.businessSlug = newSlug;
    await seller.save();
    usedSlugs.add(newSlug);

    console.log(`  DONE ${seller.email} — "${oldSlug}" -> "${newSlug}"`);
  }

  console.log('\nMigration complete');
  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
