require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Category = require('./models/Category');
const PlatformSettings = require('./models/PlatformSettings');

const categories = [
  { name: 'Tech Gadgets', slug: 'tech-gadgets', icon: '⚡', description: 'Smart devices, accessories & electronic gifts', displayOrder: 1 },
  { name: 'Handmade & Artisan', slug: 'handmade-artisan', icon: '🎨', description: 'Handcrafted gifts with a personal touch', displayOrder: 2 },
  { name: 'Home & Decor', slug: 'home-decor', icon: '🏠', description: 'Beautiful items for home and office', displayOrder: 3 },
  { name: 'Food & Gourmet', slug: 'food-gourmet', icon: '🍫', description: 'Chocolate boxes, hampers & gourmet treats', displayOrder: 4 },
  { name: 'Wellness & Self-Care', slug: 'wellness-self-care', icon: '🧘', description: 'Skincare, candles & relaxation gifts', displayOrder: 5 },
  { name: 'Stationery & Office', slug: 'stationery-office', icon: '✏️', description: 'Notebooks, pens & desk accessories', displayOrder: 6 },
  { name: 'Fashion & Accessories', slug: 'fashion-accessories', icon: '👜', description: 'Bags, wallets & wearable gifts', displayOrder: 7 },
  { name: 'Toys & Puzzles', slug: 'toys-puzzles', icon: '🧩', description: 'Fun, mind-bending & brain teaser gifts', displayOrder: 8 },
  { name: 'Personalized Gifts', slug: 'personalized-gifts', icon: '💝', description: 'Custom engraved, printed & bespoke gifts', displayOrder: 9 },
  { name: 'Gift Hampers', slug: 'gift-hampers', icon: '🎁', description: 'Curated gift boxes & hamper sets', displayOrder: 10 },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Seed categories
    await Category.deleteMany({});
    await Category.insertMany(categories);
    console.log(`Seeded ${categories.length} categories`);

    // Seed platform settings
    await PlatformSettings.deleteMany({});
    await PlatformSettings.create({
      globalCommissionRate: 0,
      paymentGatewayFeeRate: 3,
      payoutSchedule: 'biweekly',
      minimumPayoutAmount: 500,
      minimumProductPrice: 200,
      supportEmail: process.env.SMTP_USER || '',
      platformName: 'Giftsity',
      tagline: 'The Gift Marketplace'
    });
    console.log('Seeded platform settings (0% commission)');

    // Ensure admin user exists
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@giftsity.com';
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      admin = await User.create({
        email: adminEmail,
        name: 'Admin',
        phone: '',
        userType: 'admin',
        status: 'active',
        isProfileComplete: true
      });
      console.log(`Created admin: ${adminEmail}`);
    } else {
      admin.userType = 'admin';
      admin.status = 'active';
      await admin.save();
      console.log(`Updated admin: ${adminEmail}`);
    }

    console.log('\nSeed complete!');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
