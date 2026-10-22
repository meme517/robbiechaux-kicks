/**
 * OWNER WORKFLOW — bulk-import a NAMED MODEL LIST from Google Shopping.
 * -----------------------------------------------------------------------------
 * For every name in the list this script searches the provider, picks the
 * candidate that best matches the requested model. Name, price, brand, colorway
 * and listing link always come from that same shopping result; third-party
 * images are not republished or joined by array position or rank.
 *
 * Usage:
 *   npm run import:wishlist                 import the built-in list
 *   npm run import:wishlist -- --dry-run    search + print, write no products
 *   npm run import:wishlist -- --file list.txt
 *   npm run import:wishlist -- --all-colorways
 *   npm run import:wishlist -- --limit 10   stop after N models (smoke test)
 *
 * HONESTY NOTES
 *  - Google Shopping listing USD prices are converted to RWF using the configured rate.
 *  - Seller listing prices are market references, not guaranteed store prices.
 *  - Sizes are included only when explicitly present in a result; local stock is
 *    always unknown and listings cannot be added to the cart.
 *  - Search results are cached to preserve the free monthly request allowance.
 */
import { connectMongo, closeMongo, productsCollection, allowlistCollection } from '../db/mongo.js';
import { config } from '../config/env.js';
import { productSchema, type Category, type Product } from '../models/product.js';
import { ProviderError, type ProviderProduct } from '../provider/kicksdb.js';
import { hasSerpApiKey, searchGoogleShoppingProducts } from '../provider/serpapi.js';

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
  // Women's flats, heels, everyday shoes and boots
  "Women's Mary Jane Shoes", "Women's Pointed-Toe Flats",
  "Women's Classic Pumps", "Women's Stiletto Heels", "Women's Block Heels",
  "Women's Kitten Heels", "Women's Court Shoes", "Women's Slingback Heels",
  "Women's Peep-Toe Heels", "Women's Wedge Shoes", "Women's Platform Heels",
  "Women's Elegant Loafers", "Women's Mules", "Women's Dress Shoes",
  "Women's Wedding Shoes", "Women's Ankle Boots", "Women's Knee-High Boots",
  "Women's Chelsea Boots", "Women's Heeled Boots", "Women's Sandals",
  "Women's Flat Sandals", "Women's Elegant Slides", "Women's Espadrilles",
  "Women's Sneakers", "Women's Running Shoes", "Women's Casual Shoes",
  // Additional men's boot models
  "Men's Chelsea Boots", "Men's Hiking Boots", "Men's Combat Boots",
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
    .replace(/'s\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(value: string): string[] {
  return normalize(value).split(' ').filter(Boolean);
}

const FOOTWEAR_TYPES = new Set(['sneakers', 'soccer', 'football', 'sandals', 'boots']);
const FOOTWEAR_TAG =
  /\b(sneaker|shoes?|boots?|sandals?|slides?|clogs?|loafers?|mules?|cleats?|soccer|football|basketball|lifestyle|performance|running|hiking)\b/;

/** The provider also indexes apparel and accessories — never import those. */
function isFootwear(c: ProviderProduct): boolean {
  const listingText = normalize(`${c.name} ${c.model ?? ''}`);
  if (/\b(glove|jersey|shirt|sock|short|pants|apparel|backpack|hat|cap|ball)\b/.test(listingText)) {
    return false;
  }
  if (c.productType && FOOTWEAR_TYPES.has(normalize(c.productType))) return true;
  const tags = normalize(
    [...(c.categories ?? []), c.category ?? '', c.secondaryCategory ?? ''].join(' '),
  );
  return FOOTWEAR_TAG.test(tags);
}

function matchesRequestedCategory(query: string, candidate: ProviderProduct): boolean {
  const category = QUERY_CATEGORY_OVERRIDES[query];
  if (!category) return true;
  const title = normalize(`${candidate.name} ${candidate.model ?? ''}`);
  const cues: Partial<Record<Category, RegExp>> = {
    heels: /\b(heel|pump|stiletto|slingback|wedge)\b/,
    flats: /\b(flat|mary jane|ballerina)\b/,
    boots: /\bboot\b/,
    sandals: /\bsandal\b/,
    slides: /\b(slide|mule)\b/,
    espadrilles: /\bespadrille\b/,
    loafers: /\bloafer\b/,
    football: /\b(cleat|soccer|football)\b/,
  };
  const cue = cues[category];
  return !cue || cue.test(title);
}

function equivalentToken(left: string, right: string): boolean {
  if (left === right) return true;
  return left.length > 3 && right.length > 3 && (
    left.replace(/s$/, '') === right.replace(/s$/, '')
  );
}

function tokensContainInOrder(target: string, phraseTokens: string[]): boolean {
  const targetTokens = tokens(target);
  let next = 0;
  for (const token of targetTokens) {
    const expected = phraseTokens[next];
    if (expected && equivalentToken(token, expected)) next += 1;
    if (next === phraseTokens.length) return true;
  }
  return false;
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

/**
 * Find the most specific phrase from the query that the provider actually
 * carries. Matching is token-contiguous ("air jordan 3" never matches
 * "air jordan 37") and longest-phrase-first, so "Nike Air Jordan 1 High"
 * does not collapse to a generic "nike" match.
 */
function matchCandidates(query: string, candidates: ProviderProduct[]): Match | null {
  const strippedTokens = tokens(stripBrandPrefix(query));
  if (strippedTokens.length === 0) return null;
  const brand = brandOf(query);
  const hits = candidates.filter((candidate) => {
    const candidateText = `${candidate.model ?? ''} ${candidate.name}`;
    const childListing = /\b(kids?|toddler|youth|infant|gs|grade school)\b/.test(normalize(candidateText));
    if (childListing && !/\b(kids?|toddler|youth|infant|gs|grade school)\b/.test(normalize(query))) return false;
    if (!tokensContainInOrder(candidateText, strippedTokens)) return false;
    if (!matchesRequestedCategory(query, candidate)) return false;
    return !brand || sameBrand(candidate, brand);
  });
  return hits.length > 0 ? { phrase: strippedTokens.join(' '), candidates: hits } : null;
}

/**
 * Closest silhouette first: a 3-word model ("Air Max 90") is a better answer
 * to "Nike Air Max" than a 6-word special edition. Provider order breaks ties.
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

function hasUsablePrice(c: ProviderProduct): boolean {
  return preferredPrice(c) !== null;
}

function toRwf(usd: number | null | undefined, rate: number): number | null {
  if (usd === null || usd === undefined || !Number.isFinite(usd) || usd <= 0) return null;
  return Math.max(500, Math.round((usd * rate) / 500) * 500);
}

function preferredPrice(c: ProviderProduct): number | null {
  return [c.providerAvgPriceUsd, c.providerMinPriceUsd, c.providerMaxPriceUsd].find(
    (price): price is number => typeof price === 'number' && Number.isFinite(price) && price > 0,
  ) ?? null;
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
  if (/\bespadrille/.test(tags)) return 'espadrilles';
  if (/\b(sandal|flip flop)/.test(tags)) return 'sandals';
  if (/\b(slide|mule)/.test(tags)) return 'slides';
  if (/\b(flat|mary jane)/.test(tags)) return 'flats';
  if (/\b(heel|pump|court shoe|wedge|slingback)/.test(tags)) return 'heels';
  if (/\bloafer/.test(tags)) return 'loafers';
  if (/\bboot/.test(tags)) return 'boots';
  if (/\b(heeled?|pump|dress)\b/.test(tags)) return 'formal';
  if (/\bcasual\b/.test(tags)) return 'casual';
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
  "Women's Mary Jane Shoes": 'flats',
  "Women's Pointed-Toe Flats": 'flats',
  "Women's Classic Pumps": 'heels',
  "Women's Stiletto Heels": 'heels',
  "Women's Block Heels": 'heels',
  "Women's Kitten Heels": 'heels',
  "Women's Court Shoes": 'heels',
  "Women's Slingback Heels": 'heels',
  "Women's Peep-Toe Heels": 'heels',
  "Women's Wedge Shoes": 'heels',
  "Women's Platform Heels": 'heels',
  "Women's Elegant Loafers": 'loafers',
  "Women's Mules": 'slides',
  "Women's Dress Shoes": 'formal',
  "Women's Wedding Shoes": 'formal',
  "Women's Ankle Boots": 'boots',
  "Women's Knee-High Boots": 'boots',
  "Women's Chelsea Boots": 'boots',
  "Women's Heeled Boots": 'boots',
  "Women's Combat Boots": 'boots',
  "Women's Sandals": 'sandals',
  "Women's Flat Sandals": 'sandals',
  "Women's Elegant Slides": 'slides',
  "Women's Espadrilles": 'espadrilles',
  "Women's Sneakers": 'sneakers',
  "Women's Running Shoes": 'running',
  "Women's Casual Shoes": 'casual',
  "Men's Chelsea Boots": 'boots',
  "Men's Hiking Boots": 'boots',
  "Men's Combat Boots": 'boots',
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
  seen: Set<string>,
): Promise<Plan> {
  // Strip brand prefixes first for better model matching, then retry the full
  // phrase if the narrower shopping query did not yield a match.
  const stripped = stripBrandPrefix(query);
  const attempts = stripped && stripped !== normalize(query) ? [stripped, normalize(query)] : [normalize(query)];

  let match: Match | null = null;
  let lastFailure: { kind: string; message: string } | null = null;
  let searched = 0;
  for (const attempt of attempts) {
    let candidates: ProviderProduct[];
    try {
      candidates = await searchGoogleShoppingProducts(attempt);
      searched += 1;
    } catch (err) {
      if (!(err instanceof ProviderError) || err.kind !== 'not_found') throw err;
      lastFailure = { kind: err.kind, message: err.message };
      continue;
    }
    // Require a footwear category before matching; a model number alone can
    // also match apparel and accessories.
    const footwear = candidates.filter(isFootwear);
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

  // Closest silhouette first, then popularity.
  const ranked = rankCandidates(match.candidates);
  const best = ranked.find(hasUsablePrice);
  if (!best) {
    return { query, provider: ranked[0] ?? null, product: null, reason: 'no provider market price' };
  }

  if (seen.has(best.providerProductId)) {
    return {
      query,
      provider: best,
      product: null,
      reason: `already imported as another list entry ("${best.name}")`,
    };
  }

  const source = best;

  const category = QUERY_CATEGORY_OVERRIDES[query] ?? categoryFor(source);
  if (!category) {
    return { query, provider: best, product: null, reason: 'provider taxonomy has no store category' };
  }

  const priceUsd = preferredPrice(source);
  const priceRwf = toRwf(priceUsd, config.catalog.usdToRwfRate);
  if (priceRwf === null) {
    return { query, provider: best, product: null, reason: 'provider returned no usable price' };
  }
  const sizeVariants = [
    ...new Map(
      (source.variants ?? [])
        .filter((variant) => variant.size.trim())
        .map((variant) => {
          const listedSize = variant.size.trim();
          const alreadyHasSystem = variant.sizeType && new RegExp(`^${variant.sizeType}\\b`, 'i').test(listedSize);
          const size = variant.sizeType && !alreadyHasSystem
            ? `${variant.sizeType.toUpperCase()} ${listedSize}`
            : listedSize;
          return [normalize(size), { ...variant, size }];
        }),
    ).values(),
  ];
  const record: Product = {
    id: `serpapi:${best.providerProductId}`,
    provider: 'serpapi',
    providerProductId: source.providerProductId,
    sku: blank(source.sku),
    // Name and images come from the SAME provider record — never joined.
    name: source.name,
    brand: blank(source.brand),
    colorway: blank(source.colorway),
    category,
    imageUrl: 'unavailable',
    gallery: ['unavailable'],
    sourceUrl: source.sourceUrl,
    priceRwf,
    sizeSystem: blank(sizeVariants.find((variant) => variant.sizeType)?.sizeType),
    variants: sizeVariants.map((variant) => ({
      id: `size-${normalize(variant.size).replace(/\s+/g, '-')}`,
      size: variant.size,
      stock: null,
    })),
    verificationStatus: 'verified',
    published: true,
    imageIsCatalogArt: false,
    arrivedAt: new Date().toISOString(),
  };

  const parsed = productSchema.safeParse(record);
  if (!parsed.success) {
    return {
      query,
      provider: source,
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
        source: 'google-shopping',
        matchedPhrase: match.phrase,
        sourcePriceUsd: priceUsd,
        usdToRwfRate: config.catalog.usdToRwfRate,
        priceIsConverted: true,
        stockIsUnconfirmed: true,
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
  if (!hasSerpApiKey()) {
    console.error('No SERPAPI_API_KEY configured. Set it in server/.env first.');
    process.exitCode = 2;
    return;
  }

  const limit = arg('limit') ? Number(arg('limit')) : undefined;
  const dryRun = flag('dry-run');
  const allColorways = flag('all-colorways');

  const list = (await loadList()).slice(0, limit);
  console.log(`Searching Google Shopping for ${list.length} model(s)...\n`);

  await connectMongo();
  const seen = new Set<string>();
  const plans: Plan[] = [];
  for (const query of list) {
    plans.push(await planImport(query, seen));
    if (plans.length % 10 === 0) process.stdout.write(`  ...${plans.length}/${list.length}\n`);
  }

  const imported = plans.filter((p) => p.product);
  const skipped = plans.filter((p) => !p.product);

  console.log('\n=== MATCHED ===');
  for (const p of imported) {
    const product = p.product as Product;
    console.log(`${p.query}`);
    console.log(`  -> ${product.name}`);
    console.log(`     ${product.id}  ${product.category}  RWF ${product.priceRwf}`);
    const referenceUsd =
      p.provider?.providerAvgPriceUsd ??
      p.provider?.providerMinPriceUsd ??
      p.provider?.providerMaxPriceUsd;
    if (referenceUsd !== null && referenceUsd !== undefined) {
      console.log(`     converted listing price: ${referenceUsd} USD @ ${config.catalog.usdToRwfRate}`);
    }
    console.log(`     image: ${product.imageUrl}`);
    console.log(
      product.variants.length > 0
        ? `     sizes shown in listing: ${product.variants.map((v) => v.size).join(', ')} (local stock unconfirmed)`
        : '     size not provided in search result; ask store to confirm',
    );
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
    console.log('Dry run — no catalog products written. Shopping search results were cached.');
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
      { provider: 'serpapi', providerProductId: product.providerProductId },
      {
        $set: {
          provider: 'serpapi',
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
    'Google Shopping offer prices are references converted to RWF using USD_TO_RWF_RATE. Confirm the actual store price and local size availability before ordering.',
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
