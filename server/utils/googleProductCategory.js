/**
 * Map Giftsity category slugs to Google product taxonomy IDs.
 * Fallback: 7119 (Crafts).
 * @see https://support.google.com/merchants/answer/6324436
 */

const CATEGORY_MAP = {
  'tech-gadgets': '176',
  'handmade-artisan': '7119',
  'home-decor': '206',
  'food-gourmet': '422',
  'wellness-self-care': '133',
  'stationery-office': '4551',
  'fashion-accessories': '166',
  'toys-puzzles': '220',
  'personalized-gifts': '7119',
  'gift-hampers': '7119'
};

const FALLBACK_CATEGORY = '7119'; // Crafts

/**
 * Get Google product taxonomy ID for a Giftsity category slug.
 * @param {string} slug - Product category slug (e.g. 'tech-gadgets')
 * @returns {string} Google taxonomy ID
 */
function getGoogleProductCategory(slug) {
  if (!slug || typeof slug !== 'string') return FALLBACK_CATEGORY;
  const normalized = slug.trim().toLowerCase();
  return CATEGORY_MAP[normalized] || FALLBACK_CATEGORY;
}

module.exports = { getGoogleProductCategory, CATEGORY_MAP, FALLBACK_CATEGORY };
