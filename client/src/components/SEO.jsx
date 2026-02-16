import { Helmet } from 'react-helmet-async';

const SITE_NAME = 'Giftsity';
const DEFAULT_DESCRIPTION = 'India\'s marketplace for creators. Discover unique products from verified Instagram sellers, artists & online entrepreneurs. 0% platform fee for creators.';
const DEFAULT_URL = 'https://giftsity.com';

export default function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords = 'gifts, creator marketplace, Instagram seller, creator store India, sell online India, online seller platform, corporate gifts, online gifts India, unique gifts, tech gifts, artisan gifts, Giftsity',
  image,
  url,
  type = 'website',
  noIndex = false,
}) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Where India's Creators Sell`;
  const pageUrl = url || DEFAULT_URL;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      {image && <meta property="og:image" content={image} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}

      {/* Canonical */}
      <link rel="canonical" href={pageUrl} />
    </Helmet>
  );
}
