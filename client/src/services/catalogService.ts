/**
 * =============================================================================
 * CATALOG SERVICE (client)
 * -----------------------------------------------------------------------------
 * The browser ONLY talks to our own API (VITE_API_BASE_URL). It never calls the
 * third-party provider directly and never sees a provider API key.
 *
 * Two modes:
 *   'api'  : GET {base}/api/products  and  /api/products/:id
 *   'demo' : clearly-labelled local demo records (design preview; never real orders)
 * =============================================================================
 */
import { storeConfig } from '../config/storeConfig';
import { demoCatalog } from '../data/demoCatalog';
import type { CatalogMeta, Product } from '../types/product';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

export function isDemoMode(): boolean {
  return storeConfig.catalog.mode === 'demo';
}

export class CatalogError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 500, code = 'catalog_error') {
    super(message);
    this.name = 'CatalogError';
    this.status = status;
    this.code = code;
  }
}

interface ApiEnvelope<T> {
  data: T;
  meta?: CatalogMeta;
}

async function request<T>(path: string, signal?: AbortSignal): Promise<ApiEnvelope<T>> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch {
    throw new CatalogError('Could not reach the store server. Please try again.', 0, 'network');
  }
  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body?.error?.message) message = body.error.message;
    } catch {
      /* keep default message */
    }
    throw new CatalogError(message, res.status, 'http_error');
  }
  return (await res.json()) as ApiEnvelope<T>;
}

/** Runtime guard for a product coming from the API. */
function isProduct(value: unknown): value is Product {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.imageUrl === 'string' &&
    Array.isArray(p.gallery) &&
    Array.isArray(p.variants) &&
    (typeof p.priceRwf === 'number' || p.priceRwf === null)
  );
}

interface CatalogSnapshot {
  products: Product[];
  meta: CatalogMeta | null;
}

let catalogPromise: Promise<CatalogSnapshot> | null = null;
let catalogSnapshot: CatalogSnapshot | null = null;

const catalogListeners = new Set<(snapshot: CatalogSnapshot) => void>();

/**
 * Subscribe to catalog resolution. Consumers that read the synchronous
 * snapshot (e.g. the cart) use this to re-render once the catalog has loaded,
 * instead of being stuck on the empty pre-load state.
 */
export function subscribeCatalog(listener: (snapshot: CatalogSnapshot) => void): () => void {
  catalogListeners.add(listener);
  if (catalogSnapshot) listener(catalogSnapshot);
  return () => {
    catalogListeners.delete(listener);
  };
}

function notifyCatalog(snapshot: CatalogSnapshot): void {
  catalogListeners.forEach((listener) => listener(snapshot));
}

function demoSnapshot(): CatalogSnapshot {
  return {
    products: demoCatalog,
    meta: {
      storeName: storeConfig.storeName,
      currency: storeConfig.currency,
      deliveryArea: storeConfig.delivery.area,
      imageUseApproved: false,
      imageAttribution: 'Demo placeholder artwork',
      catalogStatus: 'live',
      catalogMessage: 'Demo preview catalog — records are clearly labelled placeholders.',
      count: demoCatalog.length,
    },
  };
}

export function getCatalog(): Promise<CatalogSnapshot> {
  if (!catalogPromise) {
    catalogPromise = (isDemoMode()
      ? Promise.resolve(demoSnapshot())
      : request<Product[]>('/api/products').then((env) => ({
          products: (env.data ?? []).filter(isProduct),
          meta: env.meta ?? null,
        }))
    )
      .then((snapshot) => {
        catalogSnapshot = snapshot;
        notifyCatalog(snapshot);
        return snapshot;
      })
      .catch((error) => {
        catalogPromise = null; // allow retry
        throw error;
      });
  }
  return catalogPromise;
}

/** Synchronous access to an already-resolved snapshot (null otherwise). */
export function peekCatalog(): CatalogSnapshot | null {
  return catalogSnapshot;
}

export function resetCatalogCache(): void {
  catalogPromise = null;
  catalogSnapshot = null;
}

export async function getProductById(id: string): Promise<{ product: Product; related: Product[] } | null> {
  if (isDemoMode()) {
    const product = demoCatalog.find((p) => p.id === id) ?? null;
    if (!product) return null;
    const related = demoCatalog.filter((p) => p.id !== id && p.category === product.category).slice(0, 4);
    return { product, related };
  }
  try {
    const env = await request<Product>(`/api/products/${encodeURIComponent(id)}`);
    if (!isProduct(env.data)) return null;
    const relatedRaw = (env as unknown as { related?: unknown }).related;
    const related = Array.isArray(relatedRaw) ? relatedRaw.filter(isProduct) : [];
    return { product: env.data, related };
  } catch (error) {
    if (error instanceof CatalogError && error.status === 404) return null;
    throw error;
  }
}

/** Capacity report used by the status banner ("setup pending" vs live). */
export async function getServerStatus(): Promise<{
  providerKeyConfigured: boolean;
  contactFormConfigured: boolean;
} | null> {
  if (isDemoMode()) return { providerKeyConfigured: false, contactFormConfigured: false };
  try {
    const env = await request<{ providerKeyConfigured: boolean; contactFormConfigured: boolean }>(
      '/api/status',
    );
    return env.data;
  } catch {
    return null;
  }
}

export { CATEGORY_LABELS, categoryLabel } from '../types/product';

/** Filter options derived from actual published inventory. */
export function deriveFilterOptions(products: Product[]) {
  const categories = [...new Set(products.map((p) => p.category))].sort();
  const brands = [...new Set(products.map((p) => p.brand).filter((b): b is string => Boolean(b)))].sort();
  const sizeSet = new Set<string>();
  products.forEach((p) => p.variants.filter((v) => v.stock > 0).forEach((v) => sizeSet.add(v.size)));
  const sizes = [...sizeSet].sort((a, b) => Number(a) - Number(b));
  const prices = products.map((p) => p.priceRwf ?? 0);
  const priceMin = prices.length ? Math.min(...prices) : 0;
  const priceMax = prices.length ? Math.max(...prices) : 0;
  const hasArrivalDates = products.some((p) => Boolean(p.arrivedAt));
  return { categories, brands, sizes, priceMin, priceMax, hasArrivalDates };
}

export interface ShopFilters {
  query: string;
  category: string;
  brand: string;
  size: string;
  priceMin: string;
  priceMax: string;
  sort: string;
}

export function filterAndSortProducts(products: Product[], filters: ShopFilters): Product[] {
  const q = filters.query.trim().toLowerCase();
  const min = filters.priceMin === '' ? null : Number(filters.priceMin);
  const max = filters.priceMax === '' ? null : Number(filters.priceMax);

  const filtered = products.filter((p) => {
    if (filters.category && p.category !== filters.category) return false;
    if (filters.brand && p.brand !== filters.brand) return false;
    if (filters.size && !p.variants.some((v) => v.size === filters.size && v.stock > 0)) return false;
    const price = p.priceRwf ?? 0;
    if (min !== null && Number.isFinite(min) && price < min) return false;
    if (max !== null && Number.isFinite(max) && price > max) return false;
    if (q) {
      const haystack = [p.name, p.brand ?? '', p.sku ?? '', p.colorway ?? '', p.category]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered];
  switch (filters.sort) {
    case 'price-asc':
      sorted.sort((a, b) => (a.priceRwf ?? 0) - (b.priceRwf ?? 0));
      break;
    case 'price-desc':
      sorted.sort((a, b) => (b.priceRwf ?? 0) - (a.priceRwf ?? 0));
      break;
    case 'name-asc':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'newest':
      sorted.sort((a, b) => Date.parse(b.arrivedAt ?? '') - Date.parse(a.arrivedAt ?? ''));
      break;
    default:
      sorted.sort((a, b) => {
        const score = (p: Product) => (p.featured ? 0 : 1);
        return score(a) - score(b) || a.name.localeCompare(b.name);
      });
  }
  return sorted;
}
