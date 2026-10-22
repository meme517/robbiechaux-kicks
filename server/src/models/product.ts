import { z } from 'zod';

/**
 * =============================================================================
 * NORMALIZED PRODUCT MODEL (runtime-validated)
 * -----------------------------------------------------------------------------
 * TypeScript types alone do not validate data returned by an external API.
 * These Zod schemas validate every record at the boundary (provider import,
 * database read) before it can reach the public catalog.
 * =============================================================================
 */

export const CATEGORIES = [
  'sneakers',
  'running',
  'football',
  'basketball',
  'casual',
  'flats',
  'heels',
  'sandals',
  'espadrilles',
  'loafers',
  'formal',
  'slides',
  'clogs',
  'boots',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const VERIFICATION_STATUSES = ['pending', 'verified'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const providerIds = ['kicksdb', 'store', 'dummyjson'] as const;
export type ProviderId = (typeof providerIds)[number];

/**
 * MongoDB stores an absent field written from `undefined` as BSON null, so a
 * document read back can carry `null` for an optional string where the schema
 * expects `undefined`. Normalize null → undefined at the boundary rather than
 * rejecting otherwise-valid products.
 */
const optionalString = z.preprocess(
  (v) => (v === null ? undefined : v),
  z.string().min(1).optional(),
);

/** A size variant with owner-confirmed stock. */
export const variantSchema = z.object({
  id: z.string().min(1),
  size: z.string().min(1),
  /** Owner-confirmed local stock count (0 = unavailable). */
  stock: z.number().int().min(0).max(100000),
});

export type Variant = z.infer<typeof variantSchema>;

/**
 * The public catalog product shape. Every field the UI renders lives here so a
 * name and its image always travel together inside one validated record.
 */
export const productSchema = z.object({
  id: z.string().min(1),
  provider: z.enum(providerIds),
  providerProductId: optionalString,
  sku: optionalString,
  name: z.string().min(1),
  brand: optionalString,
  colorway: optionalString,
  category: z.enum(CATEGORIES),
  /** Provider/owner image used as the card image. */
  imageUrl: z.string().min(1),
  /** Full gallery from the SAME record as the name. */
  gallery: z.array(z.string().min(1)).min(1),
  sourceUrl: z.preprocess((v) => (v === null ? undefined : v), z.string().url().optional()),
  priceRwf: z.number().int().min(0).nullable(),
  sizeSystem: optionalString,
  variants: z.array(variantSchema),
  verificationStatus: z.enum(VERIFICATION_STATUSES),
  published: z.boolean(),
  featured: z.preprocess((v) => (v === null ? undefined : v), z.boolean().optional()),
  arrivedAt: z.preprocess(
    (v) => (v === null ? undefined : v),
    z.string().datetime().optional(),
  ),
  /** True when the imagery is provider catalog art, not a photo of local stock. */
  imageIsCatalogArt: z.preprocess((v) => (v === null ? undefined : v), z.boolean().optional()),
  imageAttribution: optionalString,
});

export type Product = z.infer<typeof productSchema>;

/** Fields required before a product may enter the LIVE public catalog. */
export function livePublishBlockers(product: Product): string[] {
  const blockers: string[] = [];
  if (product.verificationStatus !== 'verified') blockers.push('verificationStatus is not "verified"');
  if (!product.published) blockers.push('published is false');
  if (product.priceRwf === null) blockers.push('no owner-confirmed RWF price');
  if (!product.name?.trim()) blockers.push('missing verified name');
  if (!product.imageUrl?.trim()) blockers.push('missing verified image');
  if (product.variants.length === 0) blockers.push('no owner-confirmed size variants');
  return blockers;
}

/** A product is live-publishable only when nothing blocks it. */
export function isLivePublishable(product: Product): boolean {
  return livePublishBlockers(product).length === 0;
}

/**
 * Allowlist entry: the owner explicitly approves a provider product ID or SKU.
 * A provider search result alone NEVER becomes local inventory.
 */
export const allowlistEntrySchema = z
  .object({
    provider: z.enum(providerIds),
    providerProductId: optionalString,
    sku: optionalString,
    /** OWNER: numeric RWF selling price. null until supplied. */
    priceRwf: z.number().int().min(0).nullable(),
    category: z.enum(CATEGORIES),
    colorway: optionalString,
    sizeSystem: optionalString,
    /** Owner-confirmed variants (sizes + stock). */
    variants: z.array(variantSchema),
    featured: z.preprocess((v) => (v === null ? undefined : v), z.boolean().optional()),
    arrivedAt: z.preprocess((v) => (v === null ? undefined : v), z.string().datetime().optional()),
    notes: optionalString,
  })
  .refine((v) => Boolean(v.providerProductId || v.sku), {
    message: 'allowlist entry needs a providerProductId or an sku',
  });

export type AllowlistEntry = z.infer<typeof allowlistEntrySchema>;
