/**
 * Sync products from MongoDB to Google Merchant Center via Content API for Shopping.
 * Products appear in Free Listings (Shopping tab, Images, Search).
 */

const Product = require('../models/Product');
const { isConfigured, getAuthClient, merchantId } = require('../config/googleShopping');
const { getGoogleProductCategory } = require('../utils/googleProductCategory');
const logger = require('../utils/logger');

const BATCH_SIZE = 100;
const BASE_URL = 'https://giftsity.com';

/**
 * Strip HTML and truncate to max length.
 * @param {string} html
 * @param {number} maxLen
 * @returns {string}
 */
function stripHtml(html, maxLen = 5000) {
  if (!html || typeof html !== 'string') return '';
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

/**
 * Get first valid HTTPS image URL from product.
 * @param {object} product
 * @returns {string|null}
 */
function getImageLink(product) {
  const media = product.media?.length ? product.media : product.images;
  const first = media?.[0];
  const url = first?.url || first;
  if (typeof url === 'string' && url.startsWith('https://')) return url;
  return null;
}

/**
 * Build Content API product payload for a Giftsity product.
 * @param {object} product - Lean product doc with populated sellerId
 * @returns {object|null} Content API product or null if invalid
 */
function buildProductPayload(product) {
  const slug = product.slug?.trim();
  if (!slug) return null;

  const imageLink = getImageLink(product);
  if (!imageLink) return null; // Skip products without valid HTTPS image

  const title = (product.title || '').slice(0, 150);
  const description = stripHtml(product.description || '', 5000);
  const price = Math.max(0, Number(product.price) || 0);
  if (price <= 0) return null;

  const seller = product.sellerId;
  const brand = (seller?.sellerProfile?.businessName || seller?.name || '').trim() || 'Giftsity';

  const offerId = product._id?.toString() || slug.slice(0, 50);
  return {
    id: offerId,
    offerId,
    title,
    description: description || title,
    link: `${BASE_URL}/product/${slug}`,
    imageLink,
    contentLanguage: 'en',
    targetCountry: 'IN',
    channel: 'online',
    availability: product.stock > 0 ? 'in stock' : 'out of stock',
    condition: 'new',
    googleProductCategory: getGoogleProductCategory(product.category),
    price: {
      value: String(price.toFixed(2)),
      currency: 'INR'
    },
    brand
  };
}

/**
 * Sync products to Google Merchant Center.
 * No-op if not configured. Logs errors but does not throw.
 */
async function syncProductsToGoogle() {
  if (!isConfigured()) {
    logger.info('[Google Shopping] Not configured (missing GOOGLE_MERCHANT_ID or credentials). Skipping sync.');
    return { synced: 0, skipped: 0, errors: 0 };
  }

  try {
    const client = await getAuthClient();
    if (!client) {
      logger.warn('[Google Shopping] Auth client failed to initialize. Skipping sync.');
      return { synced: 0, skipped: 0, errors: 0 };
    }

    const products = await Product.find({
      isActive: true,
      stock: { $gt: 0 },
      slug: { $exists: true, $ne: '' },
      isCustomizable: { $ne: true }
    })
      .populate('sellerId', 'status sellerProfile.businessName name')
      .lean();

    const filtered = products.filter((p) => p.sellerId?.status !== 'suspended');
    let synced = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
      const batch = filtered.slice(i, i + BATCH_SIZE);
      for (const product of batch) {
        const payload = buildProductPayload(product);
        if (!payload) {
          skipped++;
          continue;
        }

        try {
          let attempt = 0;
          while (true) {
            try {
              await client.content.products.insert({
                merchantId,
                requestBody: payload
              });
              synced++;
              break;
            } catch (e) {
              const is429 = e.code === 429 || e.response?.status === 429;
              if (is429 && attempt < 3) {
                attempt++;
                const delay = Math.min(2000 * Math.pow(2, attempt), 10000);
                await new Promise((r) => setTimeout(r, delay));
              } else {
                throw e;
              }
            }
          }
        } catch (err) {
          errors++;
          logger.warn(`[Google Shopping] Failed to sync product ${product.slug}: ${err.message}`);
          // Continue with next product (do not throw)
        }
      }

      // Exponential backoff on 429 rate limit
      if (i + BATCH_SIZE < filtered.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    logger.info(`[Google Shopping] Sync complete: ${synced} synced, ${skipped} skipped, ${errors} errors`);
    return { synced, skipped, errors };
  } catch (err) {
    logger.error(`[Google Shopping] Sync error: ${err.message}`);
    return { synced: 0, skipped: 0, errors: 1 };
  }
}

module.exports = { syncProductsToGoogle };
