import { createHash } from 'node:crypto';
import { config } from '../config/env.js';
import { providerCacheCollection } from '../db/mongo.js';
import { ProviderError, type ProviderProduct } from './kicksdb.js';

type ShoppingResult = Record<string, unknown>;

const BRANDS = [
  'new balance',
  'under armour',
  'dr martens',
  'nike',
  'adidas',
  'puma',
  'converse',
  'vans',
  'reebok',
  'asics',
  'skechers',
  'timberland',
  'crocs',
  'birkenstock',
  'fila',
  'salomon',
  'hoka',
  'jordan',
  'on',
];

export function hasSerpApiKey(): boolean {
  return Boolean(config.serpApi.apiKey.trim());
}

function safeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === 'string') return [entry];
    if (entry && typeof entry === 'object') {
      const item = entry as Record<string, unknown>;
      return [text(item.value) ?? text(item.text)].filter((v): v is string => Boolean(v));
    }
    return [];
  });
}

function brandFrom(query: string): string | undefined {
  const normalized = query.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const brand = BRANDS.find((candidate) => normalized === candidate || normalized.startsWith(`${candidate} `));
  return brand ? brand.replace(/\b\w/g, (letter) => letter.toUpperCase()) : undefined;
}

function sizeVariant(
  value: string,
  idSeed: string,
): NonNullable<ProviderProduct['variants']>[number] | null {
  const size = value.trim().replace(/\s+/g, ' ');
  if (!size || size.length > 32) return null;
  const id = `size-${createHash('sha1').update(`${idSeed}:${size.toLowerCase()}`).digest('hex').slice(0, 12)}`;
  const sizeType = /^(us|eu|uk|cm|jp|kr)\b/i.exec(size)?.[1]?.toLowerCase();
  return { id, size, sizeType };
}

function extractSizes(item: ShoppingResult, idSeed: string): NonNullable<ProviderProduct['variants']> {
  const values: string[] = [];
  for (const field of ['size', 'shoe_size', 'shoeSize', 'sizes']) {
    values.push(...textList(item[field]));
    const value = text(item[field]);
    if (value) values.push(value);
  }

  const aspects = item.localizedAspects ?? item.localized_aspects ?? item.product_details;
  if (Array.isArray(aspects)) {
    for (const aspect of aspects) {
      if (!aspect || typeof aspect !== 'object') continue;
      const entry = aspect as Record<string, unknown>;
      const label = `${text(entry.name) ?? ''} ${text(entry.key) ?? ''}`.toLowerCase();
      if (label.includes('size')) values.push(...textList(entry.value ?? entry.values));
    }
  }

  const title = text(item.title) ?? '';
  const labeledSizes =
    /\b(?:us\s*(?:(?:men|women)(?:'s)?\s*)?(?:m|w)?|eu|uk|size)\s*[:#-]?\s*\d{1,2}(?:\.\d{1,2})?\s*(?:m|w)?\b/gi;
  values.push(...(title.match(labeledSizes) ?? []));

  return [
    ...new Map(
      values
        .map((value) => sizeVariant(value, idSeed))
        .filter((variant): variant is NonNullable<typeof variant> => variant !== null)
        .map((variant) => [variant.size.toLowerCase(), variant]),
    ).values(),
  ];
}

function toProviderProduct(item: ShoppingResult, query: string, position: number): ProviderProduct | null {
  const name = text(item.title);
  const price = typeof item.extracted_price === 'number' ? item.extracted_price : null;
  if (!name || price === null || price <= 0 || !Number.isFinite(price)) return null;

  const link =
    safeHttpUrl(item.link) ??
    safeHttpUrl(item.product_link) ??
    safeHttpUrl(item.serpapi_immersive_product_api);
  const seed = [
    text(item.product_id) ?? '',
    name,
    text(item.source) ?? '',
    link ?? '',
  ].join('|');
  const productId = `shopping-${createHash('sha256').update(seed).digest('hex').slice(0, 24)}`;
  const source = text(item.source);
  const categories = ['shoes'];

  return {
    providerProductId: productId,
    name,
    brand: text(item.brand) ?? brandFrom(query),
    model: name,
    colorway: text(item.colorway),
    imageUrl: 'unavailable',
    gallery: ['unavailable'],
    sourceUrl: link,
    productType: 'sneakers',
    categories,
    category: 'sneakers',
    providerAvgPriceUsd: price,
    variants: extractSizes(item, productId),
    rank: position,
    description: source ? `Google Shopping offer from ${source}` : undefined,
  };
}

export async function searchGoogleShoppingProducts(query: string): Promise<ProviderProduct[]> {
  if (!hasSerpApiKey()) {
    throw new ProviderError('No SERPAPI_API_KEY configured.', 'not_configured', 503);
  }
  const trimmed = query.trim();
  if (!trimmed || trimmed.length > 120) {
    throw new ProviderError('Invalid Google Shopping query.', 'malformed', 400);
  }
  const cacheKey = `serpapi-shopping:${createHash('sha256').update(trimmed.toLowerCase()).digest('hex')}`;
  const cached = await providerCacheCollection().findOne({ key: cacheKey });
  if (cached && Date.parse(cached.expiresAt) > Date.now() && Array.isArray(cached.payload)) {
    return cached.payload as ProviderProduct[];
  }

  const url = new URL('https://serpapi.com/search.json');
  url.search = new URLSearchParams({
    engine: 'google_shopping',
    q: trimmed,
    gl: 'us',
    hl: 'en',
    api_key: config.serpApi.apiKey,
  }).toString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.serpApi.timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ProviderError('Google Shopping search timed out.', 'timeout', 504);
    }
    throw new ProviderError('Could not reach Google Shopping search.', 'upstream', 502);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 || response.status === 403) {
    throw new ProviderError('SerpApi authentication failed. Check SERPAPI_API_KEY and account status.', 'auth', 502);
  }
  if (response.status === 429) {
    throw new ProviderError('SerpApi monthly search allowance or rate limit was reached.', 'rate_limit', 429);
  }
  if (!response.ok) {
    throw new ProviderError(`SerpApi request failed (${response.status}).`, 'upstream', 502);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ProviderError('SerpApi returned invalid JSON.', 'malformed', 502);
  }

  if (!payload || typeof payload !== 'object') {
    throw new ProviderError('SerpApi returned an unexpected response.', 'malformed', 502);
  }
  const data = payload as Record<string, unknown>;
  if (typeof data.error === 'string') {
    throw new ProviderError('SerpApi rejected the request. Check the key, quota, and query.', 'upstream', 502);
  }
  if (!Array.isArray(data.shopping_results)) {
    throw new ProviderError('SerpApi response did not include shopping results.', 'malformed', 502);
  }

  const products = data.shopping_results
    .filter((item): item is ShoppingResult => Boolean(item && typeof item === 'object'))
    .map((item, index) => toProviderProduct(item, trimmed, index + 1))
    .filter((item): item is ProviderProduct => item !== null);
  const now = Date.now();
  await providerCacheCollection().updateOne(
    { key: cacheKey },
    {
      $set: {
        key: cacheKey,
        payload: products,
        fetchedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + config.provider.cacheTtlSeconds * 1000).toISOString(),
      },
    },
    { upsert: true },
  );
  return products;
}
