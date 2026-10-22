/**
 * =============================================================================
 * DUMMYJSON CATALOG SOURCE (server-side only)
 * -----------------------------------------------------------------------------
 * Used while no KicksDB key is configured, so the storefront can show REAL
 * product photography instead of locally drawn placeholder SVGs.
 *
 * Rules this module exists to keep:
 *  - Name, brand, SKU, images and price are read from ONE fetched record and
 *    travel together. Nothing is joined by array position or search rank.
 *  - No record is written unless it passes the shared productSchema.
 *  - A record whose footwear type cannot be determined is SKIPPED, never
 *    guessed into a category.
 *  - The source's USD price is never presented as an RWF store price. It is
 *    converted with the owner-editable USD_TO_RWF_RATE so a product can be
 *    published at all, and the derivation is stored on the document.
 *
 * This module is never reachable from the browser: it holds no secrets, but it
 * is imported only by server code.
 * =============================================================================
 */
import { z } from 'zod';
import { config } from '../config/env.js';
import { productSchema, type Category, type Product } from '../models/product.js';

/** Categories present in the source catalog. */
const SOURCE_CATEGORIES = ['mens-shoes', 'womens-shoes'] as const;

/** EU size run used per source gender category (source carries no sizes). */
const DEFAULT_SIZE_RUN = [40, 41, 42, 43, 44, 45, 46];
const SIZE_RUNS: Record<string, number[]> = {
  'mens-shoes': DEFAULT_SIZE_RUN,
  'womens-shoes': [36, 37, 38, 39, 40, 41],
};

/**
 * Evidence-based footwear-type mapping. First confident match wins.
 * Written against actual title/description/tag text — a record that matches
 * nothing here is reported as skipped rather than forced into a bucket.
 */
const CATEGORY_RULES: { category: Category; pattern: RegExp }[] = [
  { category: 'slides', pattern: /\b(slippers?|slides?|flip[- ]?flops?)\b/i },
  { category: 'clogs', pattern: /\b(clogs?|crocs?)\b/i },
  { category: 'loafers', pattern: /\bloafers?\b/i },
  {
    category: 'formal',
    pattern:
      /\b(heels?|stilettos?|oxfords?|derbys?|dress shoes?|formal|special occasions?|evening|weddings?|parties|party)\b/i,
  },
  {
    category: 'sneakers',
    pattern: /\b(sneakers?|trainers?|cleats?|athletic|basketball|running|jogging|sports?)\b/i,
  },
];

const sourceProductSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  price: z.number().nonnegative(),
  stock: z.number().int().min(0),
  brand: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  images: z.array(z.string().url()).optional(),
  thumbnail: z.string().url().optional(),
});

const sourcePageSchema = z.object({
  products: z.array(sourceProductSchema),
  total: z.number().int().min(0),
});

type SourceProduct = z.infer<typeof sourceProductSchema>;

export interface SkippedRecord {
  id: number;
  title: string;
  reason: string;
}

function categoryFor(record: SourceProduct): Category | null {
  const haystack = [record.title, record.description, ...(record.tags ?? [])].join(' ');
  const hit = CATEGORY_RULES.find((rule) => rule.pattern.test(haystack));
  return hit ? hit.category : null;
}

/**
 * Split the source's product-level stock across the size run. The source has
 * no per-size data, so this is an even, deterministic distribution — stored for
 * the owner to correct, never presented as measured local stock.
 */
function variantsFor(sizeCategory: string, totalStock: number) {
  const run = SIZE_RUNS[sizeCategory] ?? DEFAULT_SIZE_RUN;
  const each = Math.floor(totalStock / run.length);
  let remainder = totalStock - each * run.length;
  return run.map((size) => {
    const stock = each + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return { id: `size-${size}`, size: String(size), stock };
  });
}

/** Convert the source's USD figure into an editable RWF starting price. */
export function usdToRwf(usd: number, rate = config.catalog.usdToRwfRate): number {
  if (!Number.isFinite(usd) || !Number.isFinite(rate) || rate <= 0) return 0;
  return Math.max(500, Math.round((usd * rate) / 500) * 500);
}

async function fetchPage(category: string): Promise<SourceProduct[]> {
  const url = `${config.catalog.baseUrl}/products/category/${encodeURIComponent(category)}?limit=30`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(config.catalog.timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`catalog source returned HTTP ${res.status} for ${category}`);
  }
  const parsed = sourcePageSchema.safeParse(await res.json());
  if (!parsed.success) {
    throw new Error(`catalog source returned an unexpected payload for ${category}`);
  }
  return parsed.data.products;
}

/** Build one normalized product from a single source record (or a skip reason). */
export function mapSourceProduct(
  record: SourceProduct,
  rate: number,
): { product: Product } | { skipped: SkippedRecord } {
  const category = categoryFor(record);
  if (!category) {
    return {
      skipped: {
        id: record.id,
        title: record.title,
        reason: 'footwear type could not be determined from the record',
      },
    };
  }

  const gallery = (record.images ?? []).filter((u) => Boolean(u));
  const primary = gallery[0] ?? record.thumbnail;
  if (!primary) {
    return {
      skipped: { id: record.id, title: record.title, reason: 'record carries no image' },
    };
  }

  const candidate: Product = {
    id: `dummyjson:${record.id}`,
    provider: 'dummyjson',
    providerProductId: String(record.id),
    sku: record.sku,
    // Name and images come from the SAME source record — never joined.
    name: record.title,
    brand: record.brand,
    category,
    imageUrl: primary,
    gallery: gallery.length > 0 ? gallery : [primary],
    sourceUrl: `${config.catalog.baseUrl}/products/${record.id}`,
    priceRwf: usdToRwf(record.price, rate),
    sizeSystem: 'EU',
    variants: variantsFor(record.category, record.stock),
    verificationStatus: 'verified',
    published: true,
    imageIsCatalogArt: true,
    imageAttribution: config.catalog.imageAttribution,
    arrivedAt: new Date().toISOString(),
  };

  const parsed = productSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      skipped: {
        id: record.id,
        title: record.title,
        reason: `failed validation: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
      },
    };
  }

  // Extra owner-facing provenance. productSchema strips unknown keys on the
  // way out, so this stays in Mongo (visible to GET /api/admin/products) and
  // never reaches the public API.
  return {
    product: {
      ...parsed.data,
      importMeta: {
        source: 'dummyjson',
        sourcePriceUsd: record.price,
        usdToRwfRate: rate,
        priceIsConverted: true,
      },
    } as Product,
  };
}

/**
 * Fetch the whole shoe catalog. Resolves with every record that mapped cleanly
 * plus an explicit list of anything skipped and why.
 */
export async function fetchApiCatalog(
  rate = config.catalog.usdToRwfRate,
): Promise<{ products: Product[]; skipped: SkippedRecord[] }> {
  const products: Product[] = [];
  const skipped: SkippedRecord[] = [];

  for (const category of SOURCE_CATEGORIES) {
    let records: SourceProduct[];
    try {
      records = await fetchPage(category);
    } catch (err) {
      throw new Error(
        `catalog source unreachable (${category}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    for (const record of records) {
      const mapped = mapSourceProduct(record, rate);
      if ('skipped' in mapped) skipped.push(mapped.skipped);
      else products.push(mapped.product);
    }
  }

  return { products, skipped };
}
