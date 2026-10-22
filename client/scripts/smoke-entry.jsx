/**
 * Phase 2 client smoke test — renders every route with react-dom/server and
 * asserts the release requirements that can be checked without a browser.
 * Runs in DEMO catalog mode (VITE_CATALOG_MODE=demo) so the catalog resolves
 * synchronously and the honest "demo placeholder" states can be verified.
 * Run with: npm --workspace client run test
 */
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { AppRoutes } from '../src/App';
import { CartProvider } from '../src/context/CartContext';
import ProductCard from '../src/components/ProductCard';
import Logo from '../src/components/Logo';
import { storeConfig, hasRealEmail } from '../src/config/storeConfig';
import { demoCatalog } from '../src/data/demoCatalog';
import {
  deriveFilterOptions,
  filterAndSortProducts,
  getCatalog,
  resetCatalogCache,
  isDemoMode,
  subscribeCatalog,
} from '../src/services/catalogService';
import { revalidateCart, cartLineKey } from '../src/utils/cart';
import { formatRWF } from '../src/utils/currency';
import { buildOrderMessage, storeWhatsappUrl } from '../src/utils/whatsapp';

const results = [];

if (!isDemoMode()) {
  console.error('Smoke test expects DEMO catalog mode (VITE_CATALOG_MODE=demo).');
  process.exit(1);
}

// Resolve the catalog first so hooks can read it synchronously.
await getCatalog();

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail || '' });
  } catch (error) {
    results.push({ name, ok: false, detail: error?.message || String(error) });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function render(route) {
  return renderToString(
    <StaticRouter location={route}>
      <CartProvider>
        <AppRoutes />
      </CartProvider>
    </StaticRouter>,
  );
}

const ROUTES = [
  ['/', 'Step in. Stand out.'],
  ['/shop', 'Shop'],
  ['/product/demo:court-low', 'Demo Court Low'],
  ['/product/unknown-product-id', 'Product not found'],
  ['/about', 'About Robbiechaux Kicks'],
  ['/contact', 'Contact us'],
  ['/cart', 'Your cart'],
  ['/faq', 'Frequently asked questions'],
  ['/not-a-real-page', 'Page not found'],
];

for (const [route, expected] of ROUTES) {
  await check(`route ${route} renders`, () => {
    const html = render(route);
    assert(html.includes(expected), `expected output to include "${expected}"`);
    assert(html.includes('Website developed by TETERO NSANZE Arnold'), 'footer developer credit missing');
    assert(html.includes(storeConfig.phones.primary.label), 'primary phone missing from page');
    return `${expected} found (${html.length} chars)`;
  });
}

await check('location and delivery area are present and exact', () => {
  const html = render('/contact');
  assert(html.includes('Downtown, Room L3-51, Kigali, Rwanda'), 'exact location missing');
  assert(html.includes('Kigali and nearby areas'), 'delivery area missing');
  assert(html.includes(storeConfig.phones.secondary.label), 'secondary phone missing');
  assert(html.includes('@robbiechaux.kicks'), 'instagram handle missing');
  return 'store facts OK';
});

await check('missing logo renders placeholder, never a broken image icon', () => {
  const html = renderToString(<Logo />);
  assert(html.includes('logo__placeholder') || html.includes('logo__img'), 'logo block missing');
  assert(!html.includes('broken'), 'unexpected broken-image marker');
  return 'logo fallback present';
});

await check('every demo record has name + image + price from the same record', () => {
  demoCatalog.forEach((p) => {
    assert(typeof p.id === 'string' && p.id.startsWith('demo:'), `${p.id}: id must be prefixed`);
    assert(typeof p.name === 'string' && p.name.length > 0, `${p.id}: name missing`);
    assert(typeof p.imageUrl === 'string' && p.imageUrl.length > 0, `${p.id}: image missing`);
    assert(typeof p.priceRwf === 'number', `${p.id}: price not numeric`);
    assert(Array.isArray(p.variants) && p.variants.length > 0, `${p.id}: variants missing`);
  });
  return `${demoCatalog.length} records valid`;
});

await check('prices are numeric RWF and format consistently', () => {
  const sample = formatRWF(45000);
  assert(/RWF|RF\s|FRw/i.test(sample), `unexpected RWF format: ${sample}`);
  assert(!sample.includes('$'), 'USD leaked into RWF formatting');
  return sample;
});

await check('filter options derive from inventory; sorting uses numbers', () => {
  const options = deriveFilterOptions(demoCatalog);
  assert(options.categories.length >= 5, 'expected 5 categories');
  assert(options.brands.length > 0, 'expected derived brands');
  const asc = filterAndSortProducts(demoCatalog, {
    query: '',
    category: '',
    brand: '',
    size: '',
    priceMin: '',
    priceMax: '',
    sort: 'price-asc',
  });
  for (let i = 1; i < asc.length; i += 1) {
    assert((asc[i - 1].priceRwf ?? 0) <= (asc[i].priceRwf ?? 0), 'price-asc sort broken');
  }
  const search = filterAndSortProducts(demoCatalog, {
    query: 'DEMO-COURT-LOW',
    category: '',
    brand: '',
    size: '',
    priceMin: '',
    priceMax: '',
    sort: 'featured',
  });
  assert(search.length === 1 && search[0].sku === 'DEMO-COURT-LOW', 'SKU search failed');
  return `${options.categories.length} categories, ${options.brands.length} brands`;
});

await check('cart revalidation flags price changes and unavailable items', () => {
  const lines = [
    { productId: 'demo:court-low', variantId: null, size: '42', quantity: 1, priceSnapshot: 99999, addedAt: null },
    { productId: 'no-longer-exists', variantId: null, size: null, quantity: 2, priceSnapshot: 1000, addedAt: null },
    { productId: 'demo:court-low', variantId: null, size: '39', quantity: 1, priceSnapshot: 45000, addedAt: null },
  ];
  const [changed, missing, badSize] = revalidateCart(lines, demoCatalog);
  assert(changed.status === 'price_changed', 'price change not flagged');
  assert(missing.status === 'unavailable', 'missing product not flagged');
  assert(badSize.status === 'unavailable', 'unavailable size (39) not flagged');
  assert(cartLineKey('a', null, '42') !== cartLineKey('a', null, '41'), 'line key collision');
  return 'price_changed, unavailable, unavailable-size OK';
});

await check('WhatsApp order message is URL-encoded with sizes, SKUs, RWF subtotal', () => {
  const product = demoCatalog[0];
  const message = buildOrderMessage({
    lines: [
      {
        name: 'Nike Demo Court Low',
        sku: product.sku,
        size: '42',
        quantity: 2,
        unitPrice: product.priceRwf ?? 0,
      },
    ],
    subtotal: (product.priceRwf ?? 0) * 2,
    isDemo: true,
  });
  const url = storeWhatsappUrl(message);
  assert(url.startsWith('https://wa.me/250793314037?text='), 'wa.me destination wrong');
  const decoded = decodeURIComponent(url.split('?text=')[1]);
  assert(decoded.includes('SKU DEMO-COURT-LOW'), 'SKU missing from order message');
  assert(decoded.includes('size 42'), 'size missing from order message');
  assert(decoded.includes('RWF 90,000'), 'RWF subtotal missing from message');
  assert(decoded.includes('DEMO PREVIEW'), 'demo order not marked as demo');
  assert(!/\s/.test(url.split('?text=')[1]), 'message text must be percent-encoded');
  return 'encoded order message OK';
});

await check('contact rules: placeholder email is never a mailto link', () => {
  assert(storeConfig.email === '[STORE_EMAIL]', 'email placeholder token changed');
  assert(!hasRealEmail(), 'placeholder email must not be treated as real');
  const html = render('/contact');
  assert(!html.includes('mailto:'), 'mailto link rendered for placeholder email');
  assert(html.includes('[STORE_EMAIL]'), 'email placeholder area missing');
  assert(!html.includes('Message sent'), 'form must not claim delivery with no provider');
  return 'contact form honesty OK';
});

await check('demo products render complete cards (image + name + price + sizes)', () => {
  const product = demoCatalog[0];
  const html = renderToString(
    <StaticRouter location="/shop">
      <CartProvider>
        <ProductCard product={product} />
      </CartProvider>
    </StaticRouter>,
  );
  assert(html.includes(product.imageUrl), 'image from the same record not used');
  assert(html.includes(product.name), 'product name missing');
  assert(html.includes(product.sku), 'SKU missing');
  assert(html.includes('45,000'), 'RWF price missing');
  return 'card complete';
});

await check('promotional discount is not presented as active', () => {
  const html = render('/');
  assert(!html.includes('20%'), 'historical 20% discount shown without owner config');
  return 'no unapproved promotions';
});

await check('demo mode is clearly labelled across pages', () => {
  const html = render('/shop');
  assert(html.includes('Demo catalog'), 'demo banner missing');
  assert(html.includes('placeholder'), 'demo placeholder honesty text missing');
  return 'demo labelling OK';
});

await check('cart resolves stored lines once the catalog arrives (no stuck "no longer in catalog")', async () => {
  // Reproduces the deep-link/refresh case: a stored line is read before the
  // catalog snapshot exists, then must resolve when it loads. subscribeCatalog
  // must fire with the resolved snapshot.
  resetCatalogCache();
  let notified = null;
  const unsubscribe = subscribeCatalog((snapshot) => {
    notified = snapshot;
  });
  assert(notified === null, 'listener must not fire before the catalog resolves');
  const snapshot = await getCatalog();
  unsubscribe();
  assert(notified !== null, 'listener never fired on catalog resolve');
  const product = snapshot.products.find((p) => p.id === 'demo:court-low');
  assert(product, 'demo:court-low missing from resolved catalog');
  assert(product.imageUrl.includes('demo-court-low'), 'cart image would not resolve');
  return 'catalog subscription + cart resolution OK';
});

await check('shop shows honest loading/empty state when no inventory has loaded', () => {
  // Demo mode always resolves; simulate a live-mode miss by resetting the cache
  // and rendering without awaiting — the shop must not fabricate products.
  resetCatalogCache();
  const html = renderToString(
    <StaticRouter location="/shop">
      <CartProvider>
        <AppRoutes />
      </CartProvider>
    </StaticRouter>,
  );
  assert(
    html.includes('Loading the catalog') || html.includes('Catalog setup pending'),
    'shop must show loading/empty state instead of fabricated products',
  );
  return 'honest loading/empty state OK';
});

// ---------------------------------------------------------------- reporting
let failed = 0;
for (const result of results) {
  const status = result.ok ? 'PASS' : 'FAIL';
  if (!result.ok) failed += 1;
  console.log(`${status}  ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
if (failed > 0) process.exitCode = 1;
