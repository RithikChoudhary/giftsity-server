/**
 * Giftsity — SEO & Page Health Audit
 * Checks page availability, robots.txt, sitemap, OG image,
 * external resources, GA status, and canonical redirects.
 *
 * Usage:  node seo-audit.js
 * Requires: Node 18+ (built-in fetch)
 */

const SITE = 'https://giftsity.com';
const API_BASE = 'https://giftsity-server.onrender.com/api';

// ── colour helpers ─────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
};

const PASS = `${c.green}PASS${c.reset}`;
const FAIL = `${c.red}FAIL${c.reset}`;
const WARN = `${c.yellow}WARN${c.reset}`;
const SKIP = `${c.dim}SKIP${c.reset}`;

function pad(str, len) {
  const plain = str.replace(/\x1b\[[0-9;]*m/g, '');
  return str + ' '.repeat(Math.max(0, len - plain.length));
}

// ── fetch helper with timeout ──────────────────────────────────────────
async function probe(url, method = 'GET', followRedirects = true) {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method,
      headers: { 'User-Agent': 'Giftsity-SEOBot/1.0' },
      redirect: followRedirects ? 'follow' : 'manual',
      signal: AbortSignal.timeout(15000),
    });
    const body = method === 'GET' ? await res.text() : '';
    const elapsed = Math.round(performance.now() - start);
    return { status: res.status, body, ms: elapsed, ok: res.ok || (res.status >= 300 && res.status < 400), headers: Object.fromEntries(res.headers.entries()), error: null, finalUrl: res.url };
  } catch (err) {
    const elapsed = Math.round(performance.now() - start);
    return { status: 0, body: '', ms: elapsed, ok: false, headers: {}, error: err.message, finalUrl: '' };
  }
}

// For following redirects (to check final destination)
async function probeFollow(url) {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Giftsity-SEOBot/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    const elapsed = Math.round(performance.now() - start);
    return { status: res.status, finalUrl: res.url, ms: elapsed, ok: res.ok, error: null };
  } catch (err) {
    const elapsed = Math.round(performance.now() - start);
    return { status: 0, finalUrl: '', ms: elapsed, ok: false, error: err.message };
  }
}

// ── results collector ──────────────────────────────────────────────────
const issues = [];
let passCount = 0;
let failCount = 0;
let warnCount = 0;

function record(status, section, detail) {
  if (status === PASS) passCount++;
  else if (status === FAIL) { failCount++; issues.push({ severity: 'FAIL', section, detail }); }
  else if (status === WARN) { warnCount++; issues.push({ severity: 'WARN', section, detail }); }
}

// ── sections ───────────────────────────────────────────────────────────

async function checkPageAvailability() {
  console.log(`\n${c.bold}${c.magenta}── 1. Page Availability ${'─'.repeat(40)}${c.reset}\n`);

  const pages = [
    { label: 'Homepage',        path: '/' },
    { label: 'Shop',            path: '/shop' },
    { label: 'About',           path: '/about' },
    { label: 'Contact',         path: '/contact' },
    { label: 'B2B Inquiry',     path: '/b2b' },
    { label: 'Seller Join',     path: '/seller/join' },
    { label: 'All Sellers',     path: '/sellers' },
    { label: 'Track Order',     path: '/track' },
    { label: 'Terms',           path: '/terms' },
    { label: 'Privacy',         path: '/privacy' },
    { label: 'Auth',            path: '/auth' },
    { label: 'Cart',            path: '/cart' },
    { label: 'Product (slug)',  path: '/product/aromatherapy-gift-set-6-essential-oils-hjxj4' },
    { label: '404 Page',        path: '/this-does-not-exist-12345' },
  ];

  for (const pg of pages) {
    const res = await probeFollow(`${SITE}${pg.path}`);
    const status = res.ok ? PASS : (res.error ? FAIL : WARN);
    const info = res.error ? res.error : `${res.status} (${res.ms}ms)`;
    console.log(`  ${pad(status, 12)} ${pad(pg.label, 22)} ${c.dim}${pg.path}${c.reset}  →  ${info}`);
    record(status, 'Page Availability', `${pg.label} (${pg.path}): ${info}`);
  }
}

async function checkRobotsTxt() {
  console.log(`\n${c.bold}${c.magenta}── 2. robots.txt ${'─'.repeat(46)}${c.reset}\n`);

  const res = await probe(`${SITE}/robots.txt`);
  if (!res.ok) {
    console.log(`  ${FAIL}  robots.txt not accessible (${res.status})`);
    record(FAIL, 'robots.txt', 'File not accessible');
    return;
  }
  console.log(`  ${PASS}  robots.txt found (${res.ms}ms, ${res.body.length} bytes)`);
  record(PASS, 'robots.txt', 'Found');

  // Check essential rules
  const checks = [
    { rule: 'User-agent: *',       present: res.body.includes('User-agent: *') },
    { rule: 'Allow: /',             present: res.body.includes('Allow: /') },
    { rule: 'Disallow: /admin',     present: res.body.includes('Disallow: /admin') },
    { rule: 'Disallow: /seller',    present: res.body.includes('Disallow: /seller') },
    { rule: 'Disallow: /profile',   present: res.body.includes('Disallow: /profile') },
    { rule: 'Disallow: /orders',    present: res.body.includes('Disallow: /orders') },
    { rule: 'Sitemap declaration',  present: res.body.includes('Sitemap:') },
  ];

  for (const ch of checks) {
    const st = ch.present ? PASS : WARN;
    console.log(`  ${st}  ${ch.rule}`);
    record(st, 'robots.txt', ch.rule + (ch.present ? '' : ' MISSING'));
  }

  // Check sitemap URL uses correct domain
  const sitemapMatch = res.body.match(/Sitemap:\s*(.+)/i);
  if (sitemapMatch) {
    const sitemapUrl = sitemapMatch[1].trim();
    if (sitemapUrl.includes('giftsity.com')) {
      console.log(`  ${PASS}  Sitemap URL: ${sitemapUrl}`);
      record(PASS, 'robots.txt', `Sitemap URL correct: ${sitemapUrl}`);
    } else {
      console.log(`  ${WARN}  Sitemap URL uses wrong domain: ${sitemapUrl}`);
      record(WARN, 'robots.txt', `Sitemap URL wrong domain: ${sitemapUrl}`);
    }
  }

  // Check missing disallows
  const shouldDisallow = ['/corporate', '/wishlist'];
  for (const path of shouldDisallow) {
    const has = res.body.includes(`Disallow: ${path}`);
    const st = has ? PASS : WARN;
    console.log(`  ${st}  Disallow: ${path} ${has ? '' : '(MISSING — private route not blocked)'}`);
    record(st, 'robots.txt', `Disallow: ${path}` + (has ? '' : ' MISSING'));
  }
}

async function checkSitemap() {
  console.log(`\n${c.bold}${c.magenta}── 3. sitemap.xml ${'─'.repeat(45)}${c.reset}\n`);

  const res = await probe(`${SITE}/sitemap.xml`);
  if (!res.ok) {
    console.log(`  ${FAIL}  sitemap.xml not accessible (${res.status})`);
    record(FAIL, 'sitemap.xml', 'File not accessible');
    return;
  }
  console.log(`  ${PASS}  sitemap.xml found (${res.ms}ms, ${res.body.length} bytes)`);
  record(PASS, 'sitemap.xml', 'Found');

  // Extract URLs
  const urls = [];
  const locRegex = /<loc>(.*?)<\/loc>/g;
  let match;
  while ((match = locRegex.exec(res.body)) !== null) {
    urls.push(match[1]);
  }
  console.log(`  ${c.dim}  URLs in sitemap: ${urls.length}${c.reset}`);

  // Check each URL is reachable
  for (const url of urls) {
    const r = await probeFollow(url);
    const st = r.ok ? PASS : FAIL;
    console.log(`  ${st}  ${url} → ${r.status} (${r.ms}ms)`);
    record(st, 'sitemap.xml', `${url}: ${r.ok ? 'reachable' : 'UNREACHABLE ' + r.status}`);
  }

  // Check for missing pages in static sitemap
  const missingPatterns = [
    { label: '/sellers', desc: 'All Sellers page' },
    { label: '/track', desc: 'Track Order page' },
  ];
  console.log('');
  for (const mp of missingPatterns) {
    const found = urls.some(u => u.includes(mp.label));
    const st = found ? PASS : WARN;
    console.log(`  ${st}  ${mp.desc} ${found ? 'present' : 'MISSING from sitemap'}`);
    record(st, 'sitemap.xml', `${mp.desc}: ${found ? 'present' : 'MISSING'}`);
  }

  // Check for lastmod
  const hasLastmod = res.body.includes('<lastmod>');
  const st = hasLastmod ? PASS : WARN;
  console.log(`  ${st}  <lastmod> tags: ${hasLastmod ? 'present' : 'MISSING — search engines can\'t detect freshness'}`);
  record(st, 'sitemap.xml', hasLastmod ? 'lastmod present' : 'lastmod MISSING');

  // Check dynamic sitemap from server
  console.log(`\n  ${c.dim}Checking dynamic sitemap (server-generated)...${c.reset}`);
  const dynRes = await probe(`${API_BASE}/sitemap.xml`);
  if (dynRes.ok && dynRes.body.includes('<urlset')) {
    const dynUrls = [];
    let dynMatch;
    const dynRegex = /<loc>(.*?)<\/loc>/g;
    while ((dynMatch = dynRegex.exec(dynRes.body)) !== null) dynUrls.push(dynMatch[1]);
    const hasProducts = dynUrls.some(u => u.includes('/product/'));
    const hasStores = dynUrls.some(u => u.includes('/store/'));
    const dynHasLastmod = dynRes.body.includes('<lastmod>');
    console.log(`  ${PASS}  Dynamic sitemap: ${dynUrls.length} URLs (${dynRes.ms}ms)`);
    console.log(`  ${hasProducts ? PASS : WARN}  Dynamic product pages: ${hasProducts ? `YES (${dynUrls.filter(u => u.includes('/product/')).length} products)` : 'NONE'}`);
    console.log(`  ${hasStores ? PASS : WARN}  Dynamic store pages: ${hasStores ? `YES (${dynUrls.filter(u => u.includes('/store/')).length} stores)` : 'NONE'}`);
    console.log(`  ${dynHasLastmod ? PASS : WARN}  Dynamic sitemap <lastmod>: ${dynHasLastmod ? 'present' : 'MISSING'}`);
    record(PASS, 'Dynamic sitemap', `${dynUrls.length} URLs served`);
    if (hasProducts) record(PASS, 'Dynamic sitemap', 'Product pages present');
    else record(WARN, 'Dynamic sitemap', 'No product pages');
    if (hasStores) record(PASS, 'Dynamic sitemap', 'Store pages present');
    else record(WARN, 'Dynamic sitemap', 'No store pages');
  } else {
    console.log(`  ${WARN}  Dynamic sitemap not available (${dynRes.status || dynRes.error})`);
    record(WARN, 'Dynamic sitemap', 'Not available');
  }
}

async function checkOgImage() {
  console.log(`\n${c.bold}${c.magenta}── 4. OG Preview Image ${'─'.repeat(41)}${c.reset}\n`);

  const ogUrl = `${SITE}/og-preview.png`;
  const res = await probe(ogUrl, 'HEAD');
  if (res.ok || res.status === 200) {
    console.log(`  ${PASS}  ${ogUrl} exists (${res.ms}ms)`);
    record(PASS, 'OG Image', 'og-preview.png exists');
  } else {
    console.log(`  ${FAIL}  ${ogUrl} → ${res.status || res.error}`);
    console.log(`  ${c.dim}       Referenced in index.html og:image and twitter:image meta tags.${c.reset}`);
    console.log(`  ${c.dim}       Social shares will show a broken image.${c.reset}`);
    record(FAIL, 'OG Image', `og-preview.png MISSING (${res.status || res.error})`);
  }
}

async function checkExternalResources() {
  console.log(`\n${c.bold}${c.magenta}── 5. External Resources ${'─'.repeat(39)}${c.reset}\n`);

  const resources = [
    { label: 'Google Fonts (Inter + Space Grotesk)',
      url: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap',
      critical: true,
      note: 'Render-blocking in <head>' },
    { label: 'Cashfree SDK',
      url: 'https://sdk.cashfree.com/js/v3/cashfree.js',
      critical: true,
      note: 'Render-blocking <script> in <head> — should use async/defer' },
    { label: 'Google Fonts preconnect',
      url: 'https://fonts.gstatic.com',
      critical: false,
      note: 'Preconnect target' },
  ];

  for (const r of resources) {
    const res = await probe(r.url, 'HEAD');
    const reachable = res.ok || res.status === 200 || res.status === 301 || res.status === 302 || res.status === 405;
    const st = reachable ? PASS : (r.critical ? FAIL : WARN);
    console.log(`  ${st}  ${r.label}`);
    console.log(`  ${c.dim}       ${r.url.substring(0, 80)}...${c.reset}`);
    if (r.note) console.log(`  ${c.dim}       Note: ${r.note}${c.reset}`);
    console.log(`  ${c.dim}       Status: ${res.status} (${res.ms}ms)${c.reset}`);
    record(st, 'External Resources', `${r.label}: ${reachable ? 'reachable' : 'UNREACHABLE'}`);
  }

  // Cashfree specific warning
  console.log(`\n  ${WARN}  Cashfree SDK loaded synchronously in <head>`);
  console.log(`  ${c.dim}       This blocks page rendering until the script is downloaded.${c.reset}`);
  console.log(`  ${c.dim}       Recommendation: Add 'defer' or load it only on checkout pages.${c.reset}`);
  record(WARN, 'External Resources', 'Cashfree SDK is render-blocking — should use defer');
}

async function checkGoogleAnalytics() {
  console.log(`\n${c.bold}${c.magenta}── 6. Google Analytics ${'─'.repeat(41)}${c.reset}\n`);

  // We know from source code that GA is commented out
  console.log(`  ${WARN}  Google Analytics (GA4) is commented out in index.html`);
  console.log(`  ${c.dim}       Lines 68-76: GA4 snippet exists but is wrapped in <!-- -->${c.reset}`);
  console.log(`  ${c.dim}       No traffic tracking is active. You have zero analytics data.${c.reset}`);
  record(WARN, 'Google Analytics', 'GA4 commented out — no tracking active');
}

async function checkCanonicalRedirect() {
  console.log(`\n${c.bold}${c.magenta}── 7. Canonical Redirect (www vs non-www) ${'─'.repeat(22)}${c.reset}\n`);

  // Check www → non-www redirect (don't follow redirects here)
  const wwwRes = await probe('https://www.giftsity.com', 'HEAD', false);
  const nonWwwRes = await probe('https://giftsity.com', 'HEAD', false);

  console.log(`  ${c.dim}www.giftsity.com     → status ${wwwRes.status} (${wwwRes.ms}ms)${c.reset}`);
  console.log(`  ${c.dim}giftsity.com         → status ${nonWwwRes.status} (${nonWwwRes.ms}ms)${c.reset}`);

  if (wwwRes.status >= 300 && wwwRes.status < 400) {
    const location = wwwRes.headers['location'] || '';
    console.log(`  ${PASS}  www redirects to: ${location}`);
    record(PASS, 'Canonical Redirect', `www → ${location}`);
  } else if (wwwRes.ok && nonWwwRes.ok) {
    // Both serve content — check if they return the same thing
    console.log(`  ${WARN}  Both www and non-www serve content (no redirect)`);
    console.log(`  ${c.dim}       This can cause duplicate content issues for SEO.${c.reset}`);
    console.log(`  ${c.dim}       Recommendation: Set up a 301 redirect from www → non-www (or vice versa).${c.reset}`);
    record(WARN, 'Canonical Redirect', 'Both www and non-www serve content — no redirect');
  } else {
    console.log(`  ${c.dim}  Could not determine redirect behavior${c.reset}`);
  }
}

async function checkMetaTags() {
  console.log(`\n${c.bold}${c.magenta}── 8. HTML Meta Tags (index.html) ${'─'.repeat(30)}${c.reset}\n`);

  const res = await probe(`${SITE}/`);
  if (!res.ok && !res.body) {
    console.log(`  ${FAIL}  Could not fetch homepage HTML`);
    record(FAIL, 'Meta Tags', 'Homepage unreachable');
    return;
  }

  const html = res.body;
  const checks = [
    { label: '<title> tag',               test: html.includes('<title>') },
    { label: 'meta description',          test: html.includes('name="description"') },
    { label: 'meta keywords',             test: html.includes('name="keywords"') },
    { label: 'meta robots',               test: html.includes('name="robots"') },
    { label: 'meta viewport',             test: html.includes('name="viewport"') },
    { label: 'meta charset',              test: html.includes('charset=') },
    { label: 'og:title',                  test: html.includes('property="og:title"') },
    { label: 'og:description',            test: html.includes('property="og:description"') },
    { label: 'og:image',                  test: html.includes('property="og:image"') },
    { label: 'og:url',                    test: html.includes('property="og:url"') },
    { label: 'og:type',                   test: html.includes('property="og:type"') },
    { label: 'og:locale',                 test: html.includes('property="og:locale"') },
    { label: 'twitter:card',              test: html.includes('name="twitter:card"') },
    { label: 'twitter:title',             test: html.includes('name="twitter:title"') },
    { label: 'twitter:image',             test: html.includes('name="twitter:image"') },
    { label: 'JSON-LD WebSite',           test: html.includes('"@type": "WebSite"') || html.includes('"@type":"WebSite"') },
    { label: 'JSON-LD Organization',      test: html.includes('"@type": "Organization"') || html.includes('"@type":"Organization"') },
    { label: 'JSON-LD SearchAction',      test: html.includes('SearchAction') },
    { label: 'lang="en" attribute',       test: html.includes('lang="en"') },
    { label: 'theme-color',               test: html.includes('name="theme-color"') },
    { label: 'apple-touch-icon',          test: html.includes('apple-touch-icon') },
    { label: 'canonical link',            test: html.includes('rel="canonical"') },
  ];

  for (const ch of checks) {
    const st = ch.test ? PASS : WARN;
    console.log(`  ${st}  ${ch.label}`);
    record(st, 'Meta Tags', ch.label + (ch.test ? '' : ' MISSING'));
  }

  // Check for important missing structured data
  const missingSD = [
    { label: 'JSON-LD BreadcrumbList',  present: html.includes('BreadcrumbList') },
    { label: 'JSON-LD Product (SPA)',   present: false, note: 'Dynamic — would need SSR/prerender for crawlers' },
  ];
  console.log('');
  for (const sd of missingSD) {
    const st = sd.present ? PASS : WARN;
    console.log(`  ${st}  ${sd.label} ${sd.note ? `(${sd.note})` : ''}`);
    record(st, 'Meta Tags', `${sd.label}: ${sd.present ? 'present' : 'MISSING'}`);
  }
}

async function checkSPACrawlability() {
  console.log(`\n${c.bold}${c.magenta}── 9. SPA Crawlability ${'─'.repeat(41)}${c.reset}\n`);

  // Fetch homepage as a crawler would see it (no JS)
  const res = await probe(`${SITE}/shop`);
  if (!res.ok && !res.body) {
    console.log(`  ${FAIL}  Could not fetch /shop`);
    record(FAIL, 'SPA Crawlability', '/shop unreachable');
    return;
  }

  const html = res.body;

  // Check if actual product content is in the HTML (it won't be for pure CSR)
  const hasProductContent = html.includes('product') && (html.includes('price') || html.includes('₹'));
  const hasRootDiv = html.includes('id="root"');
  const hasNoscript = html.includes('<noscript>');

  console.log(`  ${hasRootDiv ? PASS : WARN}  React root div present`);
  console.log(`  ${hasProductContent ? PASS : WARN}  Product content in initial HTML: ${hasProductContent ? 'YES (SSR/prerender)' : 'NO (client-side render only)'}`);
  console.log(`  ${hasNoscript ? PASS : WARN}  <noscript> fallback: ${hasNoscript ? 'YES' : 'NO'}`);

  if (!hasProductContent) {
    console.log(`\n  ${c.dim}  Note: This is a pure client-side rendered (CSR) React app.${c.reset}`);
    console.log(`  ${c.dim}  Search engines like Google can render JS, but:${c.reset}`);
    console.log(`  ${c.dim}  - Crawl budget is lower for JS-rendered pages${c.reset}`);
    console.log(`  ${c.dim}  - Bing, Yandex, and social crawlers may not render JS${c.reset}`);
    console.log(`  ${c.dim}  - Dynamic meta tags (react-helmet) only work after JS executes${c.reset}`);
    console.log(`  ${c.dim}  Recommendation: Consider Vercel's ISR or prerendering for key pages${c.reset}`);
    record(WARN, 'SPA Crawlability', 'Pure CSR — crawlers may not see dynamic content/meta tags');
  } else {
    record(PASS, 'SPA Crawlability', 'Content present in initial HTML');
  }
}

// ── main ───────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${c.bold}${c.cyan}╔══════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.bold}${c.cyan}║    Giftsity — SEO & Page Health Audit                ║${c.reset}`);
  console.log(`${c.bold}${c.cyan}╚══════════════════════════════════════════════════════╝${c.reset}\n`);
  console.log(`${c.dim}Site  : ${SITE}${c.reset}`);
  console.log(`${c.dim}API   : ${API_BASE}${c.reset}`);
  console.log(`${c.dim}Time  : ${new Date().toISOString()}${c.reset}`);

  await checkPageAvailability();
  await checkRobotsTxt();
  await checkSitemap();
  await checkOgImage();
  await checkExternalResources();
  await checkGoogleAnalytics();
  await checkCanonicalRedirect();
  await checkMetaTags();
  await checkSPACrawlability();

  // ── final summary ──
  console.log(`\n${c.bold}${c.cyan}── FINAL SUMMARY ${'─'.repeat(46)}${c.reset}\n`);
  console.log(`  ${c.green}PASS:${c.reset} ${passCount}`);
  console.log(`  ${c.yellow}WARN:${c.reset} ${warnCount}`);
  console.log(`  ${c.red}FAIL:${c.reset} ${failCount}`);
  console.log(`  ${c.bold}Total checks:${c.reset} ${passCount + warnCount + failCount}`);

  if (issues.length > 0) {
    console.log(`\n  ${c.bold}Issues Found:${c.reset}\n`);
    const fails = issues.filter(i => i.severity === 'FAIL');
    const warns = issues.filter(i => i.severity === 'WARN');

    if (fails.length > 0) {
      console.log(`  ${c.bold}${c.red}Critical (FAIL):${c.reset}`);
      for (const f of fails) {
        console.log(`    ${c.red}✗${c.reset} [${f.section}] ${f.detail}`);
      }
    }
    if (warns.length > 0) {
      console.log(`\n  ${c.bold}${c.yellow}Warnings (WARN):${c.reset}`);
      for (const w of warns) {
        console.log(`    ${c.yellow}!${c.reset} [${w.section}] ${w.detail}`);
      }
    }
  }

  // SEO Score
  const total = passCount + warnCount + failCount;
  const score = Math.round((passCount / total) * 100);
  const scoreColor = score >= 80 ? c.green : score >= 60 ? c.yellow : c.red;
  console.log(`\n  ${c.bold}SEO Health Score:${c.reset} ${scoreColor}${c.bold}${score}%${c.reset} (${passCount}/${total} checks passed)\n`);
}

main().catch(err => {
  console.error(`${c.red}Fatal: ${err.message}${c.reset}`);
  process.exit(1);
});
