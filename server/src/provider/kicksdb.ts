import { config, hasProviderKey } from '../config/env.js';
import { providerCacheCollection } from '../db/mongo.js';

/**
 * =============================================================================
 * KICKSDB PROVIDER CLIENT (server-side only)
 * -----------------------------------------------------------------------------
 * Verified against the official documentation on 2026-10-20:
 *   - https://docs.kicks.dev/guides            (introduction + pckt.sh migration)
 *   - https://docs.kicks.dev/guides/authentication   (Bearer key)
 *   - https://docs.kicks.dev/recipes/stockx-get-product
 *   - https://docs.kicks.dev/changelog/v3.3     (StockX endpoints migrated to the
 *                                                pckt.sh data layer on 2026-07-31)
 *
 * Endpoint contract (unchanged, still served from the same base URL):
 *   GET {baseUrl}/stockx/products?query=<sku or name>   -> { data: [ ...products ] }
 *   GET {baseUrl}/stockx/products/<id-or-slug>          -> { data: { ...product } }
 *
 * IMPORTANT response-shape rule: search returns `data` as an ARRAY, a single
 * product lookup returns `data` as an OBJECT. Both are parsed explicitly.
 *
 * The provider API key is read from a server-side env var and is never logged,
 * returned, or exposed to the browser.
 * =============================================================================
 */

export interface ProviderProduct {
  providerProductId: string;
  name: string;
  brand?: string;
  /** Provider model family ("Nike Dunk Low") — used to rank search results. */
  model?: string;
  sku?: string;
  colorway?: string;
  description?: string;
  imageUrl: string;
  gallery: string[];
  sourceUrl?: string;
  productType?: string;
  gender?: string;
  /** Provider taxonomy (e.g. ["shoes","boots"]) — the honest category source. */
  categories?: string[];
  /** StockX top-level family ("Air Jordan", "Timberland") — used to bucket records. */
  category?: string;
  secondaryCategory?: string;
  /** Provider popularity rank (lower is more popular). */
  rank?: number | null;
  /** Provider MSRP / market prices are NOT store prices. Kept only for context. */
  providerMinPriceUsd?: number | null;
  providerMaxPriceUsd?: number | null;
  providerAvgPriceUsd?: number | null;
  variants?: { id: string; size: string; sizeType?: string }[];
}

export class ProviderError extends Error {
  status: number;
  /** 'auth' | 'rate_limit' | 'not_found' | 'timeout' | 'upstream' | 'malformed' | 'not_configured' */
  kind: string;
  constructor(message: string, kind: string, status = 502) {
    super(message);
    this.name = 'ProviderError';
    this.kind = kind;
    this.status = status;
  }
}

const MAX_QUERY_LENGTH = 120;
/** SKUs are alphanumeric with dashes/dots; slugs are lowercase words. */
const SAFE_IDENTIFIER = /^[A-Za-z0-9._-]{1,120}$/;
/**
 * Search terms are human text ("Nike Dunk Low"), so they allow spaces and
 * common punctuation. They are validated RAW and encoded exactly once when the
 * upstream URL is built — encoding first would turn a space into "%20" and be
 * rejected by this pattern.
 */
const SAFE_QUERY = /^[A-Za-z0-9][A-Za-z0-9 .,'&+_()/-]{0,119}$/;

/**
 * Validate an identifier before it is placed in an upstream URL. This blocks
 * path traversal / query injection: the browser can never supply an arbitrary
 * upstream URL, only a tightly-validated ID or slug.
 */
export function assertSafeIdentifier(value: string, label = 'identifier'): string {
  const trimmed = value.trim();
  if (!trimmed) throw new ProviderError(`Empty ${label}.`, 'malformed', 400);
  if (trimmed.length > MAX_QUERY_LENGTH) throw new ProviderError(`${label} too long.`, 'malformed', 400);
  if (!SAFE_IDENTIFIER.test(trimmed)) {
    throw new ProviderError(`Invalid characters in ${label}.`, 'malformed', 400);
  }
  return trimmed;
}

/** Validate a raw search term (names as well as SKUs) before URL encoding. */
export function assertSafeSearchQuery(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new ProviderError('Empty query.', 'malformed', 400);
  if (trimmed.length > MAX_QUERY_LENGTH) throw new ProviderError('query too long.', 'malformed', 400);
  if (!SAFE_QUERY.test(trimmed)) {
    throw new ProviderError('Invalid characters in query.', 'malformed', 400);
  }
  return trimmed;
}

/** Only http(s) URLs are safe to return as `sourceUrl` (rendered as a link). */
function safeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

function cacheKey(kind: string, value: string): string {
  return `${kind}:${value.toLowerCase()}`;
}

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const doc = await providerCacheCollection().findOne({ key });
    if (doc && Date.parse(doc.expiresAt) > Date.now()) return doc.payload as T;
  } catch {
    /* cache is best-effort */
  }
  return null;
}

async function writeCache(key: string, payload: unknown): Promise<void> {
  try {
    const now = Date.now();
    await providerCacheCollection().updateOne(
      { key },
      {
        $set: {
          key,
          payload,
          fetchedAt: new Date(now).toISOString(),
          expiresAt: new Date(now + config.provider.cacheTtlSeconds * 1000).toISOString(),
        },
      },
      { upsert: true },
    );
  } catch {
    /* cache is best-effort */
  }
}

/** Map one raw provider record to a validated ProviderProduct (name+image together). */
/**
 * The provider occasionally ships double-encoded UTF-8 ("PokÃ©mon" for
 * "Pokémon"). The original bytes are recoverable, so repair them instead of
 * putting mojibake on the shelf. Anything that would decode to a replacement
 * character is left alone.
 */
export function repairText(value: string): string {
  if (!/[ÃÂ]/.test(value)) return value;
  const repaired = Buffer.from(value, 'latin1').toString('utf8');
  return repaired.includes('�') ? value : repaired;
}

export function mapProviderRecord(raw: unknown): ProviderProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : undefined;
  const title = typeof r.title === 'string' ? repairText(r.title).trim() : '';
  const image = typeof r.image === 'string' ? r.image : '';
  // A record missing id/title/image cannot be matched safely — drop it entirely
  // rather than pairing a name with an unrelated image.
  if (!id || !title || !image) return null;

  const galleryRaw = Array.isArray(r.gallery) ? r.gallery.filter((g): g is string => typeof g === 'string') : [];
  const gallery = galleryRaw.length > 0 ? galleryRaw : [image];

  const variants = Array.isArray(r.variants)
    ? r.variants
        .map((v) => {
          if (!v || typeof v !== 'object') return null;
          const vv = v as Record<string, unknown>;
          const vid = typeof vv.id === 'string' ? vv.id : '';
          const size = typeof vv.size === 'string' ? vv.size : '';
          if (!vid || !size) return null;
          return {
            id: vid,
            size,
            sizeType: typeof vv.size_type === 'string' ? vv.size_type : undefined,
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null)
    : undefined;

  const colorway =
    typeof r.colorway === 'string' && r.colorway.trim()
      ? repairText(r.colorway).trim()
      : typeof r.secondary_color === 'string' && r.secondary_color.trim()
        ? repairText(r.secondary_color).trim()
        : undefined;

  return {
    providerProductId: id,
    name: title,
    brand: typeof r.brand === 'string' ? repairText(r.brand) : undefined,
    model:
      typeof r.model === 'string' && r.model.trim() ? repairText(r.model).trim() : undefined,
    sku: typeof r.sku === 'string' ? repairText(r.sku) : undefined,
    colorway,
    description: typeof r.description === 'string' ? repairText(r.description) : undefined,
    imageUrl: image,
    gallery,
    // Never trust an arbitrary provider link: this is rendered as a live <a>.
    sourceUrl: safeHttpUrl(r.link),
    productType: typeof r.product_type === 'string' ? r.product_type : undefined,
    gender: typeof r.gender === 'string' ? r.gender : undefined,
    categories: Array.isArray(r.categories)
      ? r.categories.filter((c): c is string => typeof c === 'string')
      : undefined,
    category: typeof r.category === 'string' && r.category.trim() ? r.category.trim() : undefined,
    secondaryCategory:
      typeof r.secondary_category === 'string' && r.secondary_category.trim()
        ? r.secondary_category.trim()
        : undefined,
    rank: typeof r.rank === 'number' ? r.rank : null,
    providerMinPriceUsd: typeof r.min_price === 'number' ? r.min_price : null,
    providerMaxPriceUsd: typeof r.max_price === 'number' ? r.max_price : null,
    providerAvgPriceUsd: typeof r.avg_price === 'number' ? r.avg_price : null,
    variants,
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.provider.timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.provider.apiKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ProviderError('The product provider timed out.', 'timeout', 504);
    }
    throw new ProviderError('Could not reach the product provider.', 'upstream', 502);
  }
  clearTimeout(timer);

  if (res.status === 401 || res.status === 403) {
    throw new ProviderError('Provider authentication failed (check KICKSDB_API_KEY).', 'auth', 502);
  }
  if (res.status === 429) {
    throw new ProviderError('Provider rate limit reached. Try again later.', 'rate_limit', 429);
  }
  if (res.status === 404) {
    throw new ProviderError('Product not found at the provider.', 'not_found', 404);
  }
  if (res.status >= 500) {
    throw new ProviderError('The product provider is unavailable right now.', 'upstream', 502);
  }
  if (!res.ok) {
    throw new ProviderError(`Provider request failed (${res.status}).`, 'upstream', 502);
  }
  try {
    return await res.json();
  } catch {
    throw new ProviderError('Provider returned an invalid response.', 'malformed', 502);
  }
}

export interface ProviderStatus {
  configured: boolean;
  provider: string;
  baseUrl: string;
  imageUseApproved: boolean;
  imageAttribution: string;
  message: string;
}

export function providerStatus(): ProviderStatus {
  return {
    configured: hasProviderKey(),
    provider: config.provider.name,
    baseUrl: config.provider.baseUrl,
    imageUseApproved: config.provider.imageUseApproved,
    imageAttribution: config.provider.imageAttribution,
    message: hasProviderKey()
      ? 'Provider credentials are configured. Metadata requests may be attempted.'
      : `No provider API key configured: live provider search/approval is disabled. Published catalog imagery is imported from the configured catalog source (${config.catalog.baseUrl}) via "npm run import:api".`,
  };
}

/**
 * Search the provider for candidate products.
 * Parses `data` as an ARRAY (search response shape).
 */
export async function searchProviderProducts(
  query: string,
  limit = 50,
): Promise<ProviderProduct[]> {
  if (!hasProviderKey()) {
    throw new ProviderError(
      'No provider API key configured (KICKSDB_API_KEY).',
      'not_configured',
      503,
    );
  }
  const safeQuery = assertSafeSearchQuery(query);
  // The default page is too small to surface a specific model family, so the
  // importer asks for more rows. Capped so one call cannot drain the quota.
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit) || 50));
  const url =
    `${config.provider.baseUrl}/stockx/products?query=${encodeURIComponent(safeQuery)}` +
    `&limit=${safeLimit}`;

  const cached = await readCache<unknown>(cacheKey('search', `${safeQuery}#${safeLimit}`));
  const payload = cached ?? (await fetchJson(url));
  if (!cached) await writeCache(cacheKey('search', `${safeQuery}#${safeLimit}`), payload);

  // Search response: { data: [...] }
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) {
    throw new ProviderError('Unexpected search response shape from provider.', 'malformed', 502);
  }
  return data.map(mapProviderRecord).filter((p): p is ProviderProduct => p !== null);
}

/**
 * Look up ONE provider product by verified ID or slug.
 * Parses `data` as an OBJECT (single-product response shape).
 */
export async function getProviderProduct(idOrSlug: string): Promise<ProviderProduct> {
  if (!hasProviderKey()) {
    throw new ProviderError(
      'No provider API key configured (KICKSDB_API_KEY).',
      'not_configured',
      503,
    );
  }
  // Tolerate ids that arrive percent-encoded, but never let a malformed
  // sequence escape as an unhandled URIError.
  let decoded = idOrSlug;
  try {
    decoded = decodeURIComponent(idOrSlug);
  } catch {
    decoded = idOrSlug;
  }
  const safeId = assertSafeIdentifier(decoded, 'product id');
  const url = `${config.provider.baseUrl}/stockx/products/${encodeURIComponent(safeId)}`;

  const cached = await readCache<unknown>(cacheKey('product', safeId));
  const payload = cached ?? (await fetchJson(url));
  if (!cached) await writeCache(cacheKey('product', safeId), payload);

  // Single-product response: { data: { ... } }
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ProviderError('Unexpected product response shape from provider.', 'malformed', 502);
  }
  const mapped = mapProviderRecord(data);
  if (!mapped) {
    throw new ProviderError('Provider product record was incomplete.', 'malformed', 502);
  }
  return mapped;
}

/** Verify the API key with a minimal authenticated request. */
export async function verifyProviderAuth(query = 'DZ5485-100'): Promise<{ ok: boolean; detail: string }> {
  if (!hasProviderKey()) {
    return { ok: false, detail: 'No KICKSDB_API_KEY configured — cannot attempt a live check.' };
  }
  try {
    const url = `${config.provider.baseUrl}/stockx/products?query=${encodeURIComponent(query)}`;
    const payload = await fetchJson(url);
    const data = (payload as { data?: unknown }).data;
    if (!Array.isArray(data)) return { ok: false, detail: 'Authenticated, but response shape was unexpected.' };
    return { ok: true, detail: `Authenticated OK — provider returned ${data.length} candidate(s).` };
  } catch (err) {
    const e = err as ProviderError;
    return { ok: false, detail: `${e.kind}: ${e.message}` };
  }
}
