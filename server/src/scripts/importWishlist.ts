/**
 * OWNER WORKFLOW — bulk-import a NAMED MODEL LIST from KicksDB.
 * -----------------------------------------------------------------------------
 * For every name in the list this script searches the provider, picks the
 * candidate that best matches the requested model, and imports it with its real
 * StockX imagery. Name, brand, SKU, colorway and gallery always come from the
 * SAME provider record — nothing is joined by array position or rank.
 *
 * Usage:
 *   npm run import:wishlist                 import the built-in list
 *   npm run import:wishlist -- --dry-run    search + print, write nothing
 *   npm run import:wishlist -- --file list.txt
 *   npm run import:wishlist -- --all-colorways
 *   npm run import:wishlist -- --rate 1450 --stock 3
 *   npm run import:wishlist -- --limit 10   stop after N models (smoke test)
 *
 * HONESTY NOTES
 *  - Prices: the provider publishes USD. USD_TO_RWF_RATE converts them so a
 *    product can be published at all; each record stores the source figure.
 *  - Stock: the provider carries NO stock data. --stock (default 3) is a
 *    placeholder the owner must replace with real local stock.
 *  - A model the provider does not carry is reported as SKIPPED, never faked.
 */
import { connectMongo, closeMongo, productsCollection, allowlistCollection } from '../db/mongo.js';
import { config, hasProviderKey } from '../config/env.js';
import { productSchema, type Category, type Product, type Variant } from '../models/product.js';
import {
  searchProviderProducts,
  ProviderError,
  type ProviderProduct,
} from '../provider/kicksdb.js';

/** The models the store wants on the shelf. */
const WISHLIST: string[] = [
  // Nike
  'Nike Shox', 'Nike Air Force 1', 'Nike Air Max', 'Nike Dunk Low',
  'Nike Air Jordan 1', 'Nike Air Jordan 4', 'Nike Air Jordan 11', 'Nike Air Jordan 12',
  'Nike Air Jordan 13', 'Nike Air Jordan 3', 'Nike Air Jordan 5', 'Nike Air Jordan 6',
  'Nike Air Jordan 14', 'Nike Air Jordan 1 High', 'Nike Air Jordan 1 Low', 'Nike Air Jordan 1 Mid',
  'Nike Blazer', 'Nike Cortez', 'Nike P-6000', 'Nike Vomero', 'Nike Pegasus', 'Nike Initiator',
  'Nike V2K Run', 'Nike Tn / Air Max Plus',
  // Adidas
  'Adidas Samba', 'Adidas Campus 00s', 'Adidas Gazelle', 'Adidas Superstar', 'Adidas Stan Smith',
  'Adidas Forum Low', 'Adidas Ultraboost', 'Adidas Yeezy', 'Adidas NMD', 'Adidas Ozweego',
  'Adidas Response', 'Adidas Runfalcon', 'Adidas Duramo', 'Adidas Grand Court', 'Adidas Spezial',
  // Puma
  'Puma Suede', 'Puma Palermo', 'Puma Speedcat', 'Puma RS-X', 'Puma Cali', 'Puma Caven',
  'Puma Smash', 'Puma Flyer Runner', 'Puma Softride', 'Puma Deviate Nitro', 'Puma Future Rider',
  'Puma Carina',
  // New Balance
  'New Balance 550', 'New Balance 574', 'New Balance 530', 'New Balance 9060', 'New Balance 2002R',
  'New Balance 327', 'New Balance 990', 'New Balance 1906R',
  // Converse / Vans / Reebok / Asics / Skechers
  'Converse Chuck Taylor All Star', 'Converse Chuck 70', 'Vans Old Skool', 'Vans Knu Skool',
  'Vans Authentic', 'Reebok Classic Leather', 'Reebok Club C 85', 'Reebok Classic Nylon',
  'Asics Gel-Kayano', 'Asics Gel-Nimbus', 'Asics Gel-1130', 'Asics Gel-NYC',
  'Skechers Go Walk', "Skechers D'Lites",
  // Boots & comfort
  'Timberland Premium 6-Inch Boot', 'Dr. Martens 1460', 'Crocs Classic Clog', 'Birkenstock Arizona',
  'Fila Disruptor', 'Under Armour HOVR', 'Under Armour Charged Assert', 'Salomon XT-6',
  'Hoka Clifton', 'Hoka Bondi', 'On Cloud 5', 'On Cloudmonster',
  // Retro Jordan line
  'Jordan 1 Retro High OG', 'Jordan 4 Retro', 'Jordan 11 Retro', 'Air Jordan 1 Retro Low OG',
  // Football boots
  'Adidas Predator', 'Adidas Copa', 'Adidas F50', 'Nike Mercurial', 'Nike Phantom',
  'Puma Future', 'Puma Ultra',
];

const BRAND_PREFIXES = [
  'new balance', 'under armour', 'dr martens', 'nike', 'adidas', 'puma', 'converse',
  'vans', 'reebok', 'asics', 'skechers', 'timberland', 'crocs', 'birkenstock', 'fila', 'salomon',
  'hoka', 'jordan', 'on',
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(value: string): string[] {
  return normalize(value).split(' ').filter(Boolean);
}

/**
 * StockX serves 140x100 thumbnails by default. Same asset, just a bigger box
 * requested through the CDN's own resize params.
 */
function upgradeImageUrl(url: string): string {
  return url.replace(/([?&])w=\d+/, '$1w=900').replace(/([?&])h=\d+/, '$1h=700');
}

function upgradeImageUrls(urls: string[]): string[] {
  const upgraded = [...new Set(urls.map(upgradeImageUrl))];
  return upgraded.length > 0 ? upgraded : [];
}

const FOOTWEAR_TYPES = new Set(['sneakers', 'soccer', 'football', 'sandals', 'boots']);
const FOOTWEAR_TAG =
  /\b(sneaker|shoes?|boots?|sandals?|slides?|clogs?|loafers?|mules?|cleats?|soccer|football|basketball|lifestyle|performance|running|hiking)\b/;

/** The provider also indexes apparel and accessories — never import those. */
function isFootwear(c: ProviderProduct): boolean {
  if (c.productType && FOOTWEAR_TYPES.has(normalize(c.productType))) return true;
  const tags = normalize(
    [...(c.categories ?? []), c.category ?? '', c.secondaryCategory ?? ''].join(' '),
  );
  return FOOTWEAR_TAG.test(tags);
}

/** True when the phrase's tokens appear as a CONTIGUOUS run in `target`. */
function tokensContain(target: string, phrase: string): boolean {
  const haystack = tokens(target);
  const needle = tokens(phrase);
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let i = 0; i <= haystack.length - needle.length; i += 1) {
    if (needle.every((tok, j) => haystack[i + j] === tok)) return true;
  }
  return false;
}

/** StockX sometimes ships a grey box instead of a product photo. */
function isPlaceholder(url: string): boolean {
  return /placeholder/i.test(url);
}

/** The schema rejects empty strings, and the provider happily sends them. */
function blank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty',
];

/** "Nike Air Jordan 4" / "Air Jordan 1 Retro Low OG" -> 4 + trailing cues. */
function parseJordan(query: string): { n: number; cues: string[] } | null {
  const parts = tokens(query);
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (parts[i] !== 'jordan') continue;
    const n = Number(parts[i + 1]);
    if (Number.isInteger(n) && n >= 1 && n <= 20) {
      return { n, cues: parts.slice(i + 2).filter((t) => CUE_TOKENS.has(t)) };
    }
  }
  return null;
}

/** Trim cues in the query that a model string must also carry. */
const CUE_TOKENS = new Set(['high', 'low', 'mid', 'og', 'retro']);

/**
 * Air Jordans are indexed under `category: "Air Jordan"` with the silhouette
 * spelled out in `secondary_category` ("One", "Four", ...). Keyword search
 * alone is useless here — "Nike Air Jordan 4" mostly returns jerseys — so the
 * silhouette is read from the provider's own taxonomy instead.
 */
function jordanMatches(query: string, candidates: ProviderProduct[]): Match | null {
  const parsed = parseJordan(query);
  if (!parsed) return null;
  const word = NUMBER_WORDS[parsed.n];
  if (!word) return null;
  const cues = parsed.cues;

  const hits = candidates.filter((c) => {
    if (normalize(c.category ?? '') !== 'air jordan') return false;
    if (normalize(c.secondaryCategory ?? '') !== word) return false;
    if (cues.length === 0) return true;
    const present = new Set([...tokens(c.model ?? ''), ...tokens(c.name)]);
    return cues.every((cue) => present.has(cue));
  });
  if (hits.length === 0) return null;
  return { phrase: `Air Jordan ${parsed.n}`, candidates: hits };
}

/** Brand words at the front of the query, so "Nike Air Max" can match "Air Max 90". */
function stripBrandPrefix(value: string): string {
  let rest = normalize(value);
  let changed = true;
  while (changed) {
    changed = false;
    for (const brand of BRAND_PREFIXES) {
      if (rest.startsWith(`${brand} `)) {
        rest = rest.slice(brand.length).trim();
        changed = true;
      }
    }
  }
  return rest;
}

interface Match {
  phrase: string;
  candidates: ProviderProduct[];
}

/** Brand named at the front of the query, if any ("Puma Ultra" -> "puma"). */
function brandOf(query: string): string | null {
  const rest = normalize(query);
  for (const brand of BRAND_PREFIXES) {
    if (rest === brand || rest.startsWith(`${brand} `)) return brand;
  }
  return null;
}

/** A brand constraint must hold: "Puma Ultra" is never an adidas shoe. */
function sameBrand(c: ProviderProduct, brand: string): boolean {
  if (normalize(c.brand ?? '') === brand) return true;
  // Provider brands are sometimes longer than the query's ("Hoka One One").
  return tokens(c.model ?? '').slice(0, 1)[0] === brand;
}

/** "ultraboost" should still find a model written "Ultra Boost". */
function squashedContain(target: string, word: string): boolean {
  return tokens(target).join('').includes(word);
}

/**
 * Find the most specific phrase from the query that the provider actually
 * carries. Matching is token-contiguous ("air jordan 3" never matches
 * "air jordan 37") and longest-phrase-first, so "Nike Air Jordan 1 High"
 * does not collapse to a generic "nike" match.
 */
function matchCandidates(query: string, candidates: ProviderProduct[]): Match | null {
  const full = tokens(query);
  if (full.length === 0) return null;
  const strippedTokens = tokens(stripBrandPrefix(query));
  const brand = brandOf(query);

  const phrases: string[] = [];
  const track = (list: string[], min: number) => {
    for (let take = list.length; take >= min; take -= 1) {
      const phrase = list.slice(0, take).join(' ');
      // A bare number matches half of every catalog ("GT Cut 4", "Pegasus 41").
      if (phrase && !/^\d+$/.test(phrase) && !phrases.includes(phrase)) phrases.push(phrase);
    }
  };
  // Brand-stripped phrases come first: "Air Max" is what the provider models
  // are called, "Nike Air Max" is only what a customer asks for. Unstripped
  // phrases never fall below 2 words; a stripped phrase may be a single word
  // ("Yeezy", "Samba") — that is the point of stripping.
  if (strippedTokens.length > 0) track(strippedTokens, 1);
  if (full.length >= 2) track(full, 2);

  for (const phrase of phrases) {
    const words = tokens(phrase);
    const hits = candidates.filter((c) => {
      const model = c.model ?? '';
      // A one-word answer must be the model itself, not a coincidence in a
      // long product title ("Puma Smash" is not a "Speedcat ... Smash").
      if (words.length === 1) return tokensContain(model, phrase) || squashedContain(model, phrase);
      return tokensContain(model, phrase) || tokensContain(c.name, phrase);
    });
    if (hits.length === 0) continue;
    if (brand) {
      const branded = hits.filter((c) => sameBrand(c, brand));
      // Crossing brands only when the provider names no matching brand is
      // how "Puma Ultra" became an adidas shoe — so it is not allowed.
      if (branded.length === 0) continue;
      return { phrase, candidates: branded };
    }
    return { phrase, candidates: hits };
  }
  return null;
}

/**
 * Closest silhouette first: a 3-word model ("Air Max 90") is a better answer
 * to "Nike Air Max" than a 6-word special edition. Popularity breaks ties.
 */
function rankCandidates(candidates: ProviderProduct[]): ProviderProduct[] {
  return [...candidates].sort((a, b) => {
    const tokensA = tokens(a.model ?? a.name).length;
    const tokensB = tokens(b.model ?? b.name).length;
    if (tokensA !== tokensB) return tokensA - tokensB;
    const rankA = a.rank ?? Number.MAX_SAFE_INTEGER;
    const rankB = b.rank ?? Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) return rankA - rankB;
    if (b.gallery.length !== a.gallery.length) return b.gallery.length - a.gallery.length;
    return a.name.localeCompare(b.name);
  });
}

/** Prices the provider actually published, for price fallback below. */
function hasUsablePrice(c: ProviderProduct): boolean {
  return toRwf(c.providerAvgPriceUsd ?? c.providerMinPriceUsd ?? c.providerMaxPriceUsd, 1) !== null;
}

/**
 * Provider taxonomy -> store category. Boots and sandals get their own buckets
 * instead of being forced into "formal" or "sneakers".
 */
/**
 * Provider taxonomy -> store category. The provider PLURALISES its tokens
 * ("boots", "clogs", "slides"), so every pattern here deliberately accepts a
 * plural tail — `\bboot\b` never matches "boots" and silently filed every
 * Timberland under sneakers.
 */
function categoryFor(p: ProviderProduct): Category | null {
  const tags = normalize(
    [...(p.categories ?? []), p.category ?? '', p.secondaryCategory ?? ''].join(' '),
  );
  const productType = normalize(p.productType ?? '');

  if (/\bclog/.test(tags)) return 'clogs';
  // Cleats outrank the generic "performance" tag they often share.
  if (/\bcleat/.test(tags) || /\b(football|soccer)\b/.test(tags) || /\b(football|soccer)\b/.test(productType)) {
    return 'football';
  }
  if (/\brunning\b/.test(tags) || /\bperformance\b/.test(tags)) return 'running';
  if (/\bbasketball\b/.test(tags) || normalize(p.category ?? '') === 'air jordan') {
    return 'basketball';
  }
  if (/\b(slide|sandal|flip flop|mule)/.test(tags)) return 'slides';
  if (/\bloafer/.test(tags)) return 'loafers';
  if (/\bboot/.test(tags)) return 'boots';
  if (/\b(heeled?|pump|dress)\b/.test(tags)) return 'formal';
  if (/\b(sneaker|shoe|athletic|lifestyle)\b/.test(tags)) return 'sneakers';
  // product_type is "sneakers" for almost everything the provider carries.
  if (productType === 'sneakers') return 'sneakers';
  return null;
}

/**
 * Store category, when the provider cannot say. StockX files Timberland
 * 6-inches under `sneakers` with no "boot" token anywhere in the record, and
 * its football-boot taxonomy is unreliable. The owner named these on the
 * shopping list — that is an owner decision, not a provider claim.
 */
const QUERY_CATEGORY_OVERRIDES: Record<string, Category> = {
  'Timberland Premium 6-Inch Boot': 'boots',
  'Dr. Martens 1460': 'boots',
  // StockX cannot identify its own football boots: these arrive tagged
  // "lifestyle", "oxfords" or bare "performance". The owner named them as
  // football boots on the shopping list, so the owner's bucket wins.
  'Adidas Predator': 'football',
  'Adidas Copa': 'football',
  'Adidas F50': 'football',
  'Nike Mercurial': 'football',
  'Nike Phantom': 'football',
  'Puma Future': 'football',
  'Puma Ultra': 'football',
};

const SIZE_RUNS: Record<string, number[]> = {
  men: [40, 41, 42, 43, 44, 45, 46],
  women: [36, 37, 38, 39, 40, 41],
  kids: [33, 34, 35, 36, 37, 38],
};
const UNISEX_RUN = [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46];

function variantsFor(gender: string | undefined, stock: number): Variant[] {
  const run = SIZE_RUNS[(gender ?? '').toLowerCase()] ?? UNISEX_RUN;
  return run.map((size) => ({ id: `size-${size}`, size: String(size), stock }));
}

/** Convert the provider's USD figure into an editable RWF starting price. */
function toRwf(usd: number | null | undefined, rate: number): number | null {
  if (usd === null || usd === undefined || !Number.isFinite(usd) || usd <= 0) return null;
  return Math.max(500, Math.round((usd * rate) / 500) * 500);
}

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx === -1 ? undefined : process.argv[idx + 1];
}
const flag = (name: string) => process.argv.includes(`--${name}`);

interface Plan {
  query: string;
  provider: ProviderProduct | null;
  product: Product | null;
  reason?: string;
}

async function planImport(
  query: string,
  rate: number,
  stock: number,
  seen: Set<string>,
): Promise<Plan> {
  // KicksDB's search is fuzzy and brand-heavy queries ("Nike Air Jordan 4")
  // mostly return apparel. Strip the brand and ask for a bigger page first,
  // then fall back to the full query.
  const stripped = stripBrandPrefix(query);
  const attempts = stripped && stripped !== normalize(query) ? [stripped, normalize(query)] : [normalize(query)];

  let match: Match | null = null;
  let lastFailure: { kind: string; message: string } | null = null;
  let searched = 0;
  for (const attempt of attempts) {
    let candidates: ProviderProduct[];
    try {
      candidates = await searchProviderProducts(attempt, 50);
      searched += 1;
    } catch (err) {
      lastFailure =
        err instanceof ProviderError
          ? { kind: err.kind, message: err.message }
          : { kind: 'unknown', message: String(err) };
      continue;
    }
    // Air Jordans are matched off the provider's own taxonomy; keyword
    // matching alone cannot tell a Jordan 4 from a "GT Cut 4" jersey.
    const footwear = candidates.filter((c) => isFootwear(c) && !isPlaceholder(c.imageUrl));
    match = jordanMatches(query, footwear) ?? matchCandidates(query, footwear);
    if (match) break;
  }

  if (!match) {
    const detail = searched === 0 && lastFailure ? `provider ${lastFailure.kind}: ${lastFailure.message}` : null;
    return {
      query,
      provider: null,
      product: null,
      reason: detail ?? 'no footwear candidate matched this model',
    };
  }

  // Closest silhouette first, then popularity. Some records publish no price
  // at all — fall through to the next match instead of dropping the model.
  const ranked = rankCandidates(match.candidates);
  const best = ranked.find(hasUsablePrice);
  if (!best) {
    return {
      query,
      provider: ranked[0] ?? null,
      product: null,
      reason: 'provider returned no price for any matching colorway',
    };
  }

  if (seen.has(best.providerProductId)) {
    return {
      query,
      provider: best,
      product: null,
      reason: `already imported as another list entry ("${best.name}")`,
    };
  }

  const category = QUERY_CATEGORY_OVERRIDES[query] ?? categoryFor(best);
  if (!category) {
    return { query, provider: best, product: null, reason: 'provider taxonomy has no store category' };
  }

  const priceUsd = best.providerAvgPriceUsd ?? best.providerMinPriceUsd ?? best.providerMaxPriceUsd;
  const priceRwf = toRwf(priceUsd, rate);
  if (priceRwf === null) {
    return { query, provider: best, product: null, reason: 'provider returned no price to convert' };
  }

  const record: Product = {
    id: `kicksdb:${best.providerProductId}`,
    provider: 'kicksdb',
    providerProductId: best.providerProductId,
    sku: blank(best.sku),
    // Name and images come from the SAME provider record — never joined.
    name: best.name,
    brand: blank(best.brand),
    colorway: blank(best.colorway),
    category,
    // StockX defaults to 140x100 thumbs; the same asset is served at any size.
    imageUrl: upgradeImageUrl(best.imageUrl),
    gallery: (() => {
      const real = upgradeImageUrls(best.gallery.filter((g) => !isPlaceholder(g)));
      return real.length > 0 ? real : [upgradeImageUrl(best.imageUrl)];
    })(),
    sourceUrl: best.sourceUrl,
    priceRwf,
    sizeSystem: 'EU',
    variants: variantsFor(best.gender, stock),
    verificationStatus: 'verified',
    published: true,
    imageIsCatalogArt: true,
    imageAttribution: config.provider.imageAttribution,
    arrivedAt: new Date().toISOString(),
  };

  const parsed = productSchema.safeParse(record);
  if (!parsed.success) {
    return {
      query,
      provider: best,
      product: null,
      reason: `failed validation: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    };
  }

  seen.add(best.providerProductId);
  return {
    query,
    provider: best,
    product: {
      ...parsed.data,
      importMeta: {
        source: 'kicksdb',
        matchedPhrase: match.phrase,
        sourcePriceUsd: priceUsd,
        usdToRwfRate: rate,
        priceIsConverted: true,
        stockIsPlaceholder: true,
      },
    } as Product,
  };
}

async function loadList(): Promise<string[]> {
  const file = arg('file');
  if (!file) return WISHLIST;
  const { readFile } = await import('node:fs/promises');
  const raw = await readFile(file, 'utf8');
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

async function main() {
  if (!hasProviderKey()) {
    console.error('No KICKSDB_API_KEY configured. Set it in server/.env first.');
    process.exitCode = 2;
    return;
  }

  const rate = Number(arg('rate') ?? config.catalog.usdToRwfRate);
  const stock = Number(arg('stock') ?? 3);
  const limit = arg('limit') ? Number(arg('limit')) : undefined;
  const dryRun = flag('dry-run');
  const allColorways = flag('all-colorways');

  const list = (await loadList()).slice(0, limit);
  console.log(`Searching KicksDB for ${list.length} model(s)...\n`);

  const seen = new Set<string>();
  const plans: Plan[] = [];
  for (const query of list) {
    plans.push(await planImport(query, rate, stock, seen));
    if (plans.length % 10 === 0) process.stdout.write(`  ...${plans.length}/${list.length}\n`);
  }

  const imported = plans.filter((p) => p.product);
  const skipped = plans.filter((p) => !p.product);

  console.log('\n=== MATCHED ===');
  for (const p of imported) {
    const product = p.product as Product;
    console.log(`${p.query}`);
    console.log(`  -> ${product.name}`);
    console.log(
      `     ${product.id}  ${product.category}  ${product.priceRwf} RWF  (${p.provider?.providerAvgPriceUsd ?? p.provider?.providerMinPriceUsd} USD @ ${rate})`,
    );
    console.log(`     image: ${product.imageUrl}`);
    console.log(`     sizes: ${product.variants.map((v) => v.size).join(',')} (stock ${stock} each — placeholder)`);
  }

  if (skipped.length > 0) {
    console.log(`\n=== SKIPPED (${skipped.length}) ===`);
    for (const p of skipped) console.log(`${p.query}  —  ${p.reason}`);
  }

  if (allColorways) {
    console.log(
      '\nNote: --all-colorways is not implemented yet; one best match per model was imported.',
    );
  }

  console.log(`\n${imported.length}/${plans.length} model(s) ready.`);

  if (dryRun) {
    console.log('Dry run — nothing written.');
    return;
  }
  if (imported.length === 0) {
    console.log('Nothing to write.');
    return;
  }

  await connectMongo();
  const products = productsCollection();
  const allowlist = allowlistCollection();
  let written = 0;

  for (const plan of imported) {
    const product = plan.product as Product;
    const clean = Object.fromEntries(Object.entries(product).filter(([, v]) => v !== undefined));
    await products.updateOne({ id: product.id }, { $set: clean }, { upsert: true });
    await allowlist.updateOne(
      { provider: 'kicksdb', providerProductId: product.providerProductId },
      {
        $set: {
          provider: 'kicksdb',
          providerProductId: product.providerProductId,
          sku: product.sku,
          priceRwf: product.priceRwf,
          category: product.category,
          colorway: product.colorway,
          sizeSystem: product.sizeSystem,
          variants: product.variants,
          createdAt: new Date().toISOString(),
        },
      },
      { upsert: true },
    );
    written += 1;
  }

  console.log(`\nWrote ${written} product(s) + allowlist entries to ${config.mongo.dbName}.`);
  console.log(
    'Prices are converted from provider USD and stock is a placeholder — replace both with your own before going live.',
  );
}

main()
  .catch(async (err) => {
    console.error('\nImport failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongo().catch(() => undefined);
  });
