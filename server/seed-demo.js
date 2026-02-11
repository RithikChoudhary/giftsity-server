require('dotenv').config();
const mongoose = require('mongoose');
const Seller = require('./models/Seller');
const Product = require('./models/Product');
const Category = require('./models/Category');
const PlatformSettings = require('./models/PlatformSettings');
const { slugify } = require('./utils/slugify');

// ---- DEMO SELLERS ----
const sellers = [
  {
    email: 'artisan@demo.giftsity.com',
    name: 'Priya Sharma',
    phone: '9876543210',
    sellerProfile: {
      businessName: 'ArtisanCrafts',
      businessSlug: 'artisancrafts',
      bio: 'Handmade gifts with soul. Every piece tells a story. Based in Mumbai, crafting with love since 2022.',
      businessType: 'proprietorship',
      businessAddress: { street: '23 Linking Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400050' },
      pickupAddress: { street: '23 Linking Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400050', phone: '9876543210' },
      avatar: { url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face', publicId: '' },
      coverImage: { url: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1200&h=400&fit=crop', publicId: '' },
      rating: 4.8,
      isVerified: true,
      totalOrders: 156,
      totalSales: 234000,
      deliveredOrders: 148,
      failedOrders: 3,
      referralCode: 'ARTI2026',
      commissionRate: null
    }
  },
  {
    email: 'giftguru@demo.giftsity.com',
    name: 'Rahul Mehta',
    phone: '9876543211',
    sellerProfile: {
      businessName: 'GiftGuru',
      businessSlug: 'giftguru',
      bio: 'Tech gadgets & smart gifts for the modern age. Curated selection of the coolest products you didn\'t know you needed.',
      businessType: 'pvt_ltd',
      businessAddress: { street: '45 MG Road', city: 'Bangalore', state: 'Karnataka', pincode: '560001' },
      pickupAddress: { street: '45 MG Road', city: 'Bangalore', state: 'Karnataka', pincode: '560001', phone: '9876543211' },
      avatar: { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face', publicId: '' },
      coverImage: { url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&h=400&fit=crop', publicId: '' },
      rating: 4.5,
      isVerified: true,
      totalOrders: 89,
      totalSales: 178000,
      deliveredOrders: 82,
      failedOrders: 5,
      referralCode: 'GIFT2026',
      commissionRate: null
    }
  },
  {
    email: 'techtreats@demo.giftsity.com',
    name: 'Ananya Gupta',
    phone: '9876543212',
    sellerProfile: {
      businessName: 'TechTreats',
      businessSlug: 'techtreats',
      bio: 'Premium corporate gifting solutions. From welcome kits to festival hampers — we make your brand memorable.',
      businessType: 'pvt_ltd',
      businessAddress: { street: '12 Connaught Place', city: 'Delhi', state: 'Delhi', pincode: '110001' },
      pickupAddress: { street: '12 Connaught Place', city: 'Delhi', state: 'Delhi', pincode: '110001', phone: '9876543212' },
      avatar: { url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face', publicId: '' },
      coverImage: { url: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=1200&h=400&fit=crop', publicId: '' },
      rating: 4.9,
      isVerified: true,
      totalOrders: 210,
      totalSales: 520000,
      deliveredOrders: 205,
      failedOrders: 1,
      referralCode: 'TECH2026',
      commissionRate: null
    }
  }
];

// ---- PRODUCTS PER SELLER ----
const artisanProducts = [
  {
    title: 'Hand-Painted Ceramic Mug Set',
    description: 'Set of 2 beautifully hand-painted ceramic mugs. Each piece is unique with intricate floral patterns. Microwave & dishwasher safe. Perfect for couples or best friends.',
    price: 899, comparePrice: 1299, category: 'handmade-artisan', stock: 45,
    tags: ['handmade', 'ceramic', 'mug', 'couples', 'gift'],
    images: [{ url: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&h=600&fit=crop', publicId: '' }],
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=300&h=300&fit=crop' }],
    isFeatured: true
  },
  {
    title: 'Macrame Plant Hanger — Boho Style',
    description: 'Beautiful handwoven macrame plant hanger made with natural cotton rope. Adds a boho touch to any room. Fits pots up to 8 inches. Length: 40 inches.',
    price: 549, comparePrice: 799, category: 'home-decor', stock: 30,
    tags: ['macrame', 'plant', 'boho', 'handmade', 'decor'],
    images: [{ url: 'https://images.unsplash.com/photo-1622547748225-3fc4abd2cca0?w=600&h=600&fit=crop', publicId: '' }],
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1622547748225-3fc4abd2cca0?w=600&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1622547748225-3fc4abd2cca0?w=300&h=300&fit=crop' }]
  },
  {
    title: 'Handmade Scented Candle Gift Box',
    description: 'Set of 4 soy wax scented candles in a premium gift box. Fragrances: Lavender, Vanilla, Sandalwood, Rose. Burn time: 25 hours each. Made with essential oils.',
    price: 1299, comparePrice: 1799, category: 'wellness-self-care', stock: 60,
    tags: ['candle', 'scented', 'soy', 'gift-box', 'wellness'],
    images: [{ url: 'https://images.unsplash.com/photo-1602607999411-7c5e7a23c0ad?w=600&h=600&fit=crop', publicId: '' }],
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1602607999411-7c5e7a23c0ad?w=600&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1602607999411-7c5e7a23c0ad?w=300&h=300&fit=crop' }],
    isFeatured: true
  },
  {
    title: 'Resin Art Coaster Set — Galaxy Theme',
    description: 'Set of 4 stunning resin art coasters with galaxy/nebula theme. Each coaster is unique with swirling blues, purples, and gold accents. Cork-backed, heat resistant.',
    price: 699, comparePrice: 999, category: 'home-decor', stock: 25,
    tags: ['resin', 'coaster', 'galaxy', 'art', 'handmade'],
    images: [{ url: 'https://images.unsplash.com/photo-1610701596061-2ecf227e85b2?w=600&h=600&fit=crop', publicId: '' }],
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1610701596061-2ecf227e85b2?w=600&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1610701596061-2ecf227e85b2?w=300&h=300&fit=crop' }]
  },
  {
    title: 'Personalized Wooden Photo Frame',
    description: 'Laser-engraved wooden photo frame with custom name/date. Made from premium walnut wood. Fits 5x7 inch photos. Perfect anniversary or birthday gift.',
    price: 799, comparePrice: 1199, category: 'personalized-gifts', stock: 40,
    tags: ['personalized', 'wood', 'frame', 'photo', 'engraved'],
    images: [{ url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&h=600&fit=crop', publicId: '' }],
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=300&h=300&fit=crop' }]
  },
  {
    title: 'Hand-Knitted Infinity Scarf',
    description: 'Soft and warm hand-knitted infinity scarf in merino wool blend. Available in earthy tones. One-size-fits-all. Comes in a cloth pouch.',
    price: 1499, comparePrice: 2199, category: 'fashion-accessories', stock: 20,
    tags: ['knitted', 'scarf', 'handmade', 'wool', 'fashion'],
    images: [{ url: 'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=600&h=600&fit=crop', publicId: '' }],
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=600&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=300&h=300&fit=crop' }]
  }
];

const giftGuruProducts = [
  {
    title: 'Levitating Moon Lamp',
    description: 'Stunning 3D-printed moon lamp that floats and rotates in mid-air using magnetic levitation. 3 color modes (warm/cool/natural). Touch-sensitive base. Diameter: 14cm.',
    price: 2999, comparePrice: 4499, category: 'tech-gadgets', stock: 15,
    tags: ['moon-lamp', 'levitating', 'tech', 'desk', 'unique'],
    images: [{ url: 'https://images.unsplash.com/photo-1532274402911-5a369e4c4bb5?w=600&h=600&fit=crop', publicId: '' }],
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1532274402911-5a369e4c4bb5?w=600&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1532274402911-5a369e4c4bb5?w=300&h=300&fit=crop' }],
    isFeatured: true
  },
  {
    title: 'Smart LED Desk Organizer with Wireless Charger',
    description: 'Multi-function desk organizer with built-in 15W wireless charger, LED clock display, and 3 compartments for pens/cards. USB-C powered. Matte black finish.',
    price: 1899, comparePrice: 2799, category: 'tech-gadgets', stock: 35,
    tags: ['wireless-charger', 'desk', 'organizer', 'led', 'smart'],
    images: [{ url: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=600&h=600&fit=crop', publicId: '' }],
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=600&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=300&h=300&fit=crop' }],
    isFeatured: true
  },
  {
    title: 'Retro Pixel Art Bluetooth Speaker',
    description: 'Portable Bluetooth 5.0 speaker with LED pixel art display. Create custom animations or display album art. 10-hour battery, IPX5 waterproof, 10W output.',
    price: 2499, comparePrice: 3499, category: 'tech-gadgets', stock: 20,
    tags: ['speaker', 'bluetooth', 'pixel', 'retro', 'portable'],
    images: [{ url: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&h=600&fit=crop', publicId: '' }],
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=300&h=300&fit=crop' }]
  },
  {
    title: 'Mechanical Puzzle Box — Secret Lock',
    description: 'Beautifully crafted wooden mechanical puzzle box. Requires 12 moves to open the secret compartment. Perfect for hiding small gifts like rings or notes. Brain teaser difficulty: Medium.',
    price: 1599, comparePrice: 2299, category: 'toys-puzzles', stock: 28,
    tags: ['puzzle', 'mechanical', 'wood', 'brain-teaser', 'secret'],
    images: [{ url: 'https://images.unsplash.com/photo-1606503153255-59d8b2e4b5e4?w=600&h=600&fit=crop', publicId: '' }],
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1606503153255-59d8b2e4b5e4?w=600&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1606503153255-59d8b2e4b5e4?w=300&h=300&fit=crop' }]
  },
  {
    title: 'Mini Projector — Cinema Anywhere',
    description: 'Pocket-sized LED projector. Connects via HDMI, USB, or WiFi. Projects up to 100 inches. 1080p supported. Built-in speaker. Perfect for movie nights or presentations.',
    price: 4999, comparePrice: 7999, category: 'tech-gadgets', stock: 10,
    tags: ['projector', 'mini', 'cinema', 'portable', 'tech'],
    images: [{ url: 'https://images.unsplash.com/photo-1626379953822-baec19c3accd?w=600&h=600&fit=crop', publicId: '' }],
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1626379953822-baec19c3accd?w=600&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1626379953822-baec19c3accd?w=300&h=300&fit=crop' }]
  },
  {
    title: 'RGB LED Strip Light Kit — 10m',
    description: '10-meter RGB LED strip with remote + app control. 300 LEDs, 16 million colors, music sync mode. Easy 3M adhesive backing. Transform any room instantly.',
    price: 799, comparePrice: 1499, category: 'tech-gadgets', stock: 50,
    tags: ['led', 'rgb', 'strip', 'room', 'ambient'],
    images: [{ url: 'https://images.unsplash.com/photo-1550535424-b498819c412f?w=600&h=600&fit=crop', publicId: '' }],
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1550535424-b498819c412f?w=600&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1550535424-b498819c412f?w=300&h=300&fit=crop' }]
  },
  {
    title: 'Magnetic Hourglass Timer',
    description: 'Mesmerizing magnetic sand hourglass. Iron filings create stunning 3D sculptures as they fall through the magnetic base. 1-minute timer. Premium metal and glass construction.',
    price: 1199, comparePrice: 1799, category: 'toys-puzzles', stock: 22,
    tags: ['magnetic', 'hourglass', 'desk', 'fidget', 'unique'],
    images: [{ url: 'https://images.unsplash.com/photo-1501139083538-0139583c060f?w=600&h=600&fit=crop', publicId: '' }],
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1501139083538-0139583c060f?w=600&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1501139083538-0139583c060f?w=300&h=300&fit=crop' }]
  }
];

const techTreatsProducts = [
  {
    title: 'Premium Diwali Gift Hamper — Executive',
    description: 'Luxury gift hamper in a handcrafted wooden box. Contains: Assorted dry fruits (500g), Belgian chocolates, premium tea sampler, scented candle, silk pouch. Corporate branding available.',
    price: 3499, comparePrice: 4999, category: 'gift-hampers', stock: 100,
    tags: ['diwali', 'hamper', 'corporate', 'premium', 'luxury'],
    images: [{ url: 'https://images.unsplash.com/photo-1549465220-1a8b9238f060?w=600&h=600&fit=crop', publicId: '' }],
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1549465220-1a8b9238f060?w=600&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1549465220-1a8b9238f060?w=300&h=300&fit=crop' }],
    isFeatured: true
  },
  {
    title: 'Employee Welcome Kit — Starter',
    description: 'Branded onboarding kit: Premium notebook, metal pen, laptop sticker set, company mug, and a welcome card. All items can be customized with company logo.',
    price: 1299, comparePrice: 1899, category: 'stationery-office', stock: 200,
    tags: ['welcome-kit', 'onboarding', 'corporate', 'branded', 'employee'],
    images: [{ url: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&h=600&fit=crop', publicId: '' }],
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=300&h=300&fit=crop' }],
    isFeatured: true
  },
  {
    title: 'Gourmet Chocolate Collection Box — 24pc',
    description: '24 artisan chocolates in assorted flavors: Dark Truffle, Hazelnut Praline, Salted Caramel, Mango, Rose, Coffee. Premium packaging. Vegetarian.',
    price: 1899, comparePrice: 2499, category: 'food-gourmet', stock: 75,
    tags: ['chocolate', 'gourmet', 'artisan', 'gift-box', 'premium'],
    images: [{ url: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=600&h=600&fit=crop', publicId: '' }],
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=600&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=300&h=300&fit=crop' }]
  },
  {
    title: 'Premium Leather Journal — A5',
    description: 'Genuine leather journal with 200 pages of acid-free paper. Includes bookmark ribbon, pen loop, and inner pocket. Embossing available for corporate orders.',
    price: 999, comparePrice: 1499, category: 'stationery-office', stock: 120,
    tags: ['journal', 'leather', 'premium', 'notebook', 'writing'],
    images: [{ url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&h=600&fit=crop', publicId: '' }],
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=300&h=300&fit=crop' }]
  },
  {
    title: 'Desk Succulent Garden — 3 Plants',
    description: 'Set of 3 real succulents in minimalist concrete pots. Low maintenance, perfect desk companions. Includes care card. Gift-wrapped.',
    price: 649, comparePrice: 999, category: 'home-decor', stock: 35,
    tags: ['succulent', 'plant', 'desk', 'garden', 'minimalist'],
    images: [{ url: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=600&h=600&fit=crop', publicId: '' }],
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=600&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=300&h=300&fit=crop' }]
  },
  {
    title: 'Bamboo Wireless Charging Pad',
    description: 'Eco-friendly wireless charger made from natural bamboo. 15W fast charging, compatible with all Qi devices. Minimalist design, anti-slip pad.',
    price: 799, comparePrice: 1299, category: 'tech-gadgets', stock: 55,
    tags: ['wireless', 'charger', 'bamboo', 'eco', 'tech'],
    images: [{ url: 'https://images.unsplash.com/photo-1615526675159-e248c3021d3f?w=600&h=600&fit=crop', publicId: '' }],
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1615526675159-e248c3021d3f?w=600&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1615526675159-e248c3021d3f?w=300&h=300&fit=crop' }],
    isFeatured: true
  },
  {
    title: 'Aromatherapy Gift Set — 6 Essential Oils',
    description: 'Premium essential oils set: Lavender, Eucalyptus, Peppermint, Tea Tree, Lemon, Orange. 10ml each in amber glass bottles. Includes wooden display rack.',
    price: 1499, comparePrice: 2199, category: 'wellness-self-care', stock: 45,
    tags: ['aromatherapy', 'essential-oil', 'wellness', 'gift-set', 'natural'],
    images: [{ url: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600&h=600&fit=crop', publicId: '' }],
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600&h=600&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=300&h=300&fit=crop' }]
  }
];

// ---- CATEGORIES ----
const categoryList = [
  { name: 'Handmade & Artisan', slug: 'handmade-artisan', icon: '🎨', displayOrder: 1 },
  { name: 'Home Decor', slug: 'home-decor', icon: '🏠', displayOrder: 2 },
  { name: 'Tech Gadgets', slug: 'tech-gadgets', icon: '📱', displayOrder: 3 },
  { name: 'Wellness & Self-Care', slug: 'wellness-self-care', icon: '🧘', displayOrder: 4 },
  { name: 'Personalized Gifts', slug: 'personalized-gifts', icon: '✨', displayOrder: 5 },
  { name: 'Fashion & Accessories', slug: 'fashion-accessories', icon: '👜', displayOrder: 6 },
  { name: 'Toys & Puzzles', slug: 'toys-puzzles', icon: '🧩', displayOrder: 7 },
  { name: 'Gift Hampers', slug: 'gift-hampers', icon: '🎁', displayOrder: 8 },
  { name: 'Stationery & Office', slug: 'stationery-office', icon: '📓', displayOrder: 9 },
  { name: 'Food & Gourmet', slug: 'food-gourmet', icon: '🍫', displayOrder: 10 },
];

async function seedDemo() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Seed categories (upsert)
    for (const cat of categoryList) {
      await Category.findOneAndUpdate(
        { slug: cat.slug },
        { ...cat, isActive: true },
        { upsert: true, new: true }
      );
    }
    console.log(`Seeded ${categoryList.length} categories`);

    // Remove old demo sellers and their products
    const demoEmails = sellers.map(s => s.email);
    const existingSellers = await Seller.find({ email: { $in: demoEmails } });
    const existingIds = existingSellers.map(s => s._id);
    await Product.deleteMany({ sellerId: { $in: existingIds } });
    await Seller.deleteMany({ email: { $in: demoEmails } });
    console.log('Cleaned old demo data');

    // Create sellers
    const createdSellers = [];
    for (const sellerData of sellers) {
      const seller = new Seller({
        ...sellerData,
        status: 'active',
        isProfileComplete: true
      });
      seller.sellerProfile.approvedAt = new Date();
      await seller.save();
      createdSellers.push(seller);
      console.log(`Created seller: ${seller.sellerProfile.businessName} (${seller.email})`);
    }

    // Create products for each seller
    const productSets = [artisanProducts, giftGuruProducts, techTreatsProducts];
    let totalProducts = 0;

    for (let i = 0; i < createdSellers.length; i++) {
      const seller = createdSellers[i];
      const products = productSets[i];

      for (const prodData of products) {
        const product = new Product({
          ...prodData,
          sellerId: seller._id,
          slug: slugify(prodData.title)
        });
        await product.save();
        totalProducts++;
      }
      console.log(`  → Added ${products.length} products for ${seller.sellerProfile.businessName}`);
    }

    console.log(`\nDemo seed complete: ${createdSellers.length} sellers, ${totalProducts} products`);
    console.log('\nSeller stores:');
    createdSellers.forEach(s => {
      console.log(`  /store/${s.sellerProfile.businessSlug} — ${s.sellerProfile.businessName}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seedDemo();
