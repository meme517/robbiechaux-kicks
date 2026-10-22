/**
 * Normalized product shape as delivered by our own API (server normalizes and
 * validates provider metadata + owner inventory). Mirrors
 * server/src/models/product.ts.
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

export type VerificationStatus = 'pending' | 'verified';

export interface Variant {
  id: string;
  size: string;
  stock: number | null;
}

export interface Product {
  id: string;
  provider: 'kicksdb' | 'store' | 'dummyjson';
  providerProductId?: string;
  sku?: string;
  name: string;
  brand?: string;
  colorway?: string;
  category: Category;
  imageUrl: string;
  gallery: string[];
  sourceUrl?: string;
  priceRwf: number | null;
  sizeSystem?: string;
  variants: Variant[];
  verificationStatus: VerificationStatus;
  published: boolean;
  featured?: boolean;
  arrivedAt?: string;
  imageIsCatalogArt?: boolean;
  imageAttribution?: string;
}

export interface CatalogMeta {
  storeName: string;
  currency: string;
  deliveryArea: string;
  imageUseApproved: boolean;
  imageAttribution: string;
  catalogStatus: 'live' | 'setup_pending';
  catalogMessage: string;
  count: number;
}

/** Human-facing category labels (data uses lowercase slugs). */
export const CATEGORY_LABELS: Record<Category, string> = {
  sneakers: 'Sneakers',
  running: 'Running',
  football: 'Football',
  basketball: 'Basketball',
  casual: 'Casual',
  flats: 'Flats',
  heels: 'Heels',
  sandals: 'Sandals',
  espadrilles: 'Espadrilles',
  loafers: 'Loafers',
  formal: 'Formal',
  slides: 'Slides',
  clogs: 'Clogs',
  boots: 'Boots',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as Category] ?? category;
}

/**
 * Display name for cards, cart lines and the detail page. API-sourced records
 * already include the brand in the name ("Nike Air Jordan 1" with brand "Nike"),
 * so the brand is only prefixed when it is not already there.
 */
export function productLabel(product: { brand?: string; name: string }): string {
  const { brand, name } = product;
  if (!brand) return name;
  return name.toLowerCase().startsWith(brand.toLowerCase()) ? name : `${brand} ${name}`;
}
