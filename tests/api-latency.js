/**
 * Giftsity — API Performance Audit
 * Tests all public API endpoints for latency, status, and data validity.
 * Runs each endpoint 2x (cold + warm) to detect caching.
 *
 * Usage:  node api-latency.js
 * Requires: Node 18+ (built-in fetch)
 */

const API_BASE = 'https://giftsity-server.onrender.com/api';

// ── colour helpers (ANSI) ──────────────────────────────────────────────
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
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

function colourMs(ms) {
  if (ms < 500) return `${c.green}${ms}ms${c.reset}`;
  if (ms < 1500) return `${c.yellow}${ms}ms${c.reset}`;
  return `${c.red}${ms}ms${c.reset}`;
}

function statusColour(code) {
  if (code >= 200 && code < 300) return `${c.green}${code}${c.reset}`;
  if (code >= 300 && code < 400) return `${c.yellow}${code}${c.reset}`;
  return `${c.red}${code}${c.reset}`;
}

function pad(str, len) {
  const plain = str.replace(/\x1b\[[0-9;]*m/g, '');
  return str + ' '.repeat(Math.max(0, len - plain.length));
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── single request runner ──────────────────────────────────────────────
async function hitEndpoint(url) {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Giftsity-AuditBot/1.0' },
      signal: AbortSignal.timeout(30000),
    });
    const body = await res.text();
    const elapsed = Math.round(performance.now() - start);
    return { status: res.status, size: body.length, ms: elapsed, body, ok: res.ok, error: null };
  } catch (err) {
    const elapsed = Math.round(performance.now() - start);
    return { status: 0, size: 0, ms: elapsed, body: null, ok: false, error: err.message };
  }
}

// ── main ───────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${c.bold}${c.cyan}╔══════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.bold}${c.cyan}║    Giftsity — API Performance Audit                  ║${c.reset}`);
  console.log(`${c.bold}${c.cyan}╚══════════════════════════════════════════════════════╝${c.reset}\n`);
  console.log(`${c.dim}Server: ${API_BASE}${c.reset}`);
  console.log(`${c.dim}Time  : ${new Date().toISOString()}${c.reset}\n`);

  // Phase 1 — fetch products to extract dynamic slugs / IDs
  console.log(`${c.dim}[prep] Fetching product list to extract slugs & IDs...${c.reset}`);
  const prepRes = await hitEndpoint(`${API_BASE}/products?limit=4`);
  let productSlug = 'aromatherapy-gift-set-6-essential-oils-hjxj4'; // fallback
  let productId = null;
  let category = null;
  if (prepRes.ok) {
    try {
      const data = JSON.parse(prepRes.body);
      if (data.products?.length) {
        productSlug = data.products[0].slug;
        productId = data.products[0]._id;
        category = data.products[0].category;
      }
    } catch { /* use fallback */ }
  }

  // Phase 2 — fetch sellers to extract a seller slug
  console.log(`${c.dim}[prep] Fetching sellers to extract store slug...${c.reset}`);
  const sellerRes = await hitEndpoint(`${API_BASE}/store/featured/top-sellers`);
  let sellerSlug = 'techtreats'; // fallback
  if (sellerRes.ok) {
    try {
      const data = JSON.parse(sellerRes.body);
      const sellers = data.sellers || data;
      if (Array.isArray(sellers) && sellers.length) {
        sellerSlug = sellers[0].sellerProfile?.businessSlug || sellers[0].businessSlug || sellerSlug;
      }
    } catch { /* use fallback */ }
  }

  console.log(`${c.dim}[prep] Using product slug: ${productSlug}${c.reset}`);
  console.log(`${c.dim}[prep] Using product ID  : ${productId || 'N/A'}${c.reset}`);
  console.log(`${c.dim}[prep] Using seller slug : ${sellerSlug}${c.reset}`);
  console.log(`${c.dim}[prep] Using category    : ${category || 'N/A'}${c.reset}\n`);

  // ── endpoint list ──
  const endpoints = [
    { label: 'Home — Featured Products',    path: '/products?featured=true&limit=4' },
    { label: 'Home — New Arrivals',          path: '/products?limit=8&sort=newest' },
    { label: 'Home — Categories',            path: '/products/categories' },
    { label: 'Home — Top Sellers',           path: '/store/featured/top-sellers' },
    { label: 'Shop — Page 1',               path: '/products?limit=12&page=1' },
    { label: 'Shop — Search "gift"',        path: '/products?search=gift' },
    { label: 'Shop — Filtered',             path: `/products?category=${category || 'electronics'}&minPrice=100&maxPrice=5000` },
    { label: 'Product Detail',              path: `/products/${productSlug}` },
    { label: 'Product Reviews',             path: productId ? `/reviews/product/${productId}?limit=5` : null },
    { label: 'All Sellers',                 path: '/store/sellers?page=1&limit=24' },
    { label: 'Seller Store Profile',        path: `/store/${sellerSlug}` },
    { label: 'Seller Store Products',       path: `/store/${sellerSlug}/products?limit=200` },
    { label: 'Seller Store Reviews',        path: `/store/${sellerSlug}/reviews` },
    { label: 'Contact — Store Info',        path: '/store/info' },
  ].filter(e => e.path !== null);

  // ── run cold + warm ──
  const results = [];
  const divider = `${c.dim}${'─'.repeat(105)}${c.reset}`;

  for (const round of ['COLD', 'WARM']) {
    console.log(`${c.bold}${c.magenta}── ${round} RUN ${'─'.repeat(50)}${c.reset}\n`);
    console.log(
      `  ${pad(`${c.bold}#${c.reset}`, 6)}` +
      `${pad(`${c.bold}Endpoint${c.reset}`, 36)}` +
      `${pad(`${c.bold}Status${c.reset}`, 14)}` +
      `${pad(`${c.bold}Latency${c.reset}`, 18)}` +
      `${pad(`${c.bold}Size${c.reset}`, 14)}` +
      `${c.bold}Valid${c.reset}`
    );
    console.log(divider);

    for (let i = 0; i < endpoints.length; i++) {
      const ep = endpoints[i];
      const url = `${API_BASE}${ep.path}`;
      const res = await hitEndpoint(url);

      let valid = '—';
      if (res.ok && res.body) {
        try {
          const json = JSON.parse(res.body);
          const hasData =
            (Array.isArray(json) && json.length > 0) ||
            (json.products && json.products.length > 0) ||
            (json.sellers && json.sellers.length > 0) ||
            (json.reviews !== undefined) ||
            (json.categories && json.categories.length > 0) ||
            (json.seller) ||
            (json.product) ||
            (json.store) ||
            (json.info) ||
            (json.email) ||
            Object.keys(json).length > 0;
          valid = hasData ? `${c.green}YES${c.reset}` : `${c.yellow}EMPTY${c.reset}`;
        } catch {
          valid = `${c.red}NOT JSON${c.reset}`;
        }
      } else if (res.error) {
        valid = `${c.red}ERR${c.reset}`;
      } else {
        valid = `${c.red}FAIL${c.reset}`;
      }

      const row =
        `  ${pad(`${c.dim}${i + 1}${c.reset}`, 6)}` +
        `${pad(ep.label, 36)}` +
        `${pad(statusColour(res.status), 14)}` +
        `${pad(colourMs(res.ms), 18)}` +
        `${pad(formatBytes(res.size), 14)}` +
        `${valid}`;

      console.log(row);

      results.push({ label: ep.label, round, ...res });
    }
    console.log('');
  }

  // ── summary ──
  console.log(`${c.bold}${c.cyan}── SUMMARY ${'─'.repeat(50)}${c.reset}\n`);

  const cold = results.filter(r => r.round === 'COLD');
  const warm = results.filter(r => r.round === 'WARM');
  const failures = results.filter(r => !r.ok);

  const avgCold = Math.round(cold.reduce((s, r) => s + r.ms, 0) / cold.length);
  const avgWarm = Math.round(warm.reduce((s, r) => s + r.ms, 0) / warm.length);
  const slowest = [...results].sort((a, b) => b.ms - a.ms).slice(0, 5);

  console.log(`  ${c.bold}Endpoints tested:${c.reset}  ${endpoints.length}`);
  console.log(`  ${c.bold}Total requests:${c.reset}    ${results.length} (${cold.length} cold + ${warm.length} warm)`);
  console.log(`  ${c.bold}Avg cold latency:${c.reset}  ${colourMs(avgCold)}`);
  console.log(`  ${c.bold}Avg warm latency:${c.reset}  ${colourMs(avgWarm)}`);
  console.log(`  ${c.bold}Failed requests:${c.reset}   ${failures.length === 0 ? `${c.green}0${c.reset}` : `${c.red}${failures.length}${c.reset}`}`);

  if (failures.length > 0) {
    console.log(`\n  ${c.bold}${c.red}Failing Endpoints:${c.reset}`);
    for (const f of failures) {
      console.log(`    ${c.red}✗${c.reset} [${f.round}] ${f.label} — ${f.error || `HTTP ${f.status}`}`);
    }
  }

  console.log(`\n  ${c.bold}Top 5 Slowest Requests:${c.reset}`);
  for (const s of slowest) {
    console.log(`    ${colourMs(s.ms)}  [${s.round}] ${s.label}`);
  }

  // ── latency comparison (cold vs warm) ──
  console.log(`\n  ${c.bold}Cold vs Warm Comparison:${c.reset}`);
  for (let i = 0; i < endpoints.length; i++) {
    const coldR = cold[i];
    const warmR = warm[i];
    const diff = coldR.ms - warmR.ms;
    const arrow = diff > 0 ? `${c.green}↓ ${diff}ms faster${c.reset}` : diff < 0 ? `${c.red}↑ ${Math.abs(diff)}ms slower${c.reset}` : `${c.dim}= same${c.reset}`;
    console.log(`    ${pad(endpoints[i].label, 34)} ${colourMs(coldR.ms)} → ${colourMs(warmR.ms)}  ${arrow}`);
  }

  // ── performance grade ──
  console.log('');
  const grade =
    avgWarm < 300 ? `${c.bgGreen}${c.bold}  A  ${c.reset}` :
    avgWarm < 600 ? `${c.bgGreen}${c.bold}  B  ${c.reset}` :
    avgWarm < 1200 ? `${c.bgYellow}${c.bold}  C  ${c.reset}` :
    `${c.bgRed}${c.bold}  D  ${c.reset}`;

  console.log(`  ${c.bold}Performance Grade:${c.reset} ${grade} (based on avg warm latency)\n`);
}

main().catch(err => {
  console.error(`${c.red}Fatal: ${err.message}${c.reset}`);
  process.exit(1);
});
