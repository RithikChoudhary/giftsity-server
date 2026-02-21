/**
 * Generate a URL-friendly slug from a string.
 * Appends a short random suffix to ensure uniqueness (used for product slugs).
 */
const slugify = (text) => {
  const base = text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  const suffix = Math.random().toString(36).substring(2, 7);
  return `${base}-${suffix}`;
};

/**
 * Clean slug without random suffix (used for business name URLs).
 * "Open & Buy" -> "open-and-buy"
 */
const slugifyClean = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Generate a unique business slug by checking DB for collisions.
 * Appends -2, -3, etc. if the base slug is taken.
 */
const generateUniqueSlug = async (businessName, Seller, excludeId) => {
  const base = slugifyClean(businessName);
  if (!base) return '';
  let candidate = base;
  let counter = 1;
  while (counter < 100) {
    const query = { 'sellerProfile.businessSlug': candidate };
    if (excludeId) query._id = { $ne: excludeId };
    const exists = await Seller.findOne(query).select('_id').lean();
    if (!exists) return candidate;
    counter++;
    candidate = `${base}-${counter}`;
  }
  return `${base}-${Date.now().toString(36)}`;
};

module.exports = { slugify, slugifyClean, generateUniqueSlug };
