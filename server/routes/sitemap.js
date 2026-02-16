const express = require('express');
const Product = require('../models/Product');
const Seller = require('../models/Seller');
const router = express.Router();

/**
 * GET /api/sitemap.xml
 * Dynamic sitemap with all active products and seller stores.
 * Cached in-memory for 1 hour to avoid DB pressure from crawlers.
 */

let cachedXml = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

router.get('/sitemap.xml', async (req, res) => {
  try {
    if (cachedXml && (Date.now() - cacheTime) < CACHE_TTL) {
      res.set('Content-Type', 'application/xml');
      return res.send(cachedXml);
    }

    const BASE = 'https://giftsity.com';

    // Static pages
    const staticPages = [
      { loc: '/', priority: '1.0', changefreq: 'daily' },
      { loc: '/shop', priority: '0.9', changefreq: 'daily' },
      { loc: '/sellers', priority: '0.8', changefreq: 'daily' },
      { loc: '/track', priority: '0.6', changefreq: 'monthly' },
      { loc: '/about', priority: '0.7', changefreq: 'monthly' },
      { loc: '/contact', priority: '0.6', changefreq: 'monthly' },
      { loc: '/b2b', priority: '0.8', changefreq: 'monthly' },
      { loc: '/seller/join', priority: '0.8', changefreq: 'monthly' },
      { loc: '/terms', priority: '0.3', changefreq: 'yearly' },
      { loc: '/privacy', priority: '0.3', changefreq: 'yearly' },
      { loc: '/return-policy', priority: '0.5', changefreq: 'yearly' },
      { loc: '/shipping-policy', priority: '0.5', changefreq: 'yearly' },
    ];

    // Dynamic product pages
    const products = await Product.find({ isActive: true, stock: { $gt: 0 } })
      .select('slug updatedAt')
      .lean();

    // Dynamic seller store pages
    const sellers = await Seller.find({
      status: 'active',
      'sellerProfile.businessSlug': { $ne: '' }
    })
      .select('sellerProfile.businessSlug updatedAt')
      .lean();

    const today = new Date().toISOString().split('T')[0];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Static pages
    for (const pg of staticPages) {
      xml += `  <url>\n`;
      xml += `    <loc>${BASE}${pg.loc}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>${pg.changefreq}</changefreq>\n`;
      xml += `    <priority>${pg.priority}</priority>\n`;
      xml += `  </url>\n`;
    }

    // Product pages
    for (const p of products) {
      const lastmod = p.updatedAt ? new Date(p.updatedAt).toISOString().split('T')[0] : today;
      xml += `  <url>\n`;
      xml += `    <loc>${BASE}/product/${p.slug}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    }

    // Seller store pages
    for (const s of sellers) {
      const slug = s.sellerProfile?.businessSlug;
      if (!slug) continue;
      const lastmod = s.updatedAt ? new Date(s.updatedAt).toISOString().split('T')[0] : today;
      xml += `  <url>\n`;
      xml += `    <loc>${BASE}/store/${slug}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.7</priority>\n`;
      xml += `  </url>\n`;
    }

    xml += '</urlset>\n';

    cachedXml = xml;
    cacheTime = Date.now();

    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
});

module.exports = router;
