/**
 * Generate a URL-friendly slug from a string.
 * Appends a short random suffix to ensure uniqueness.
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

module.exports = { slugify };
