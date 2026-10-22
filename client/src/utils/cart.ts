import type { Product, Variant } from '../types/product';

/** Cart persistence + revalidation. Stored lines carry a price snapshot so
 *  price changes and unavailable items can be flagged before an order. */

const STORAGE_KEY = 'robbiechaux-cart-v2';

export interface CartLine {
  productId: string;
  variantId: string | null;
  size: string | null;
  quantity: number;
  priceSnapshot: number | null;
  addedAt: string | null;
}

export type RevalidatedStatus = 'ok' | 'price_changed' | 'unavailable';

export interface RevalidatedLine extends CartLine {
  key: string;
  product: Product | null;
  status: RevalidatedStatus;
  issue: string | null;
}

export function cartLineKey(productId: string, variantId: string | null, size: string | null): string {
  return `${productId}::${variantId ?? ''}::${size ?? ''}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function loadStoredCart(): CartLine[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((line): line is Record<string, unknown> => isRecord(line) && typeof line.productId === 'string')
      .map((line) => ({
        productId: String(line.productId),
        variantId: line.variantId != null ? String(line.variantId) : null,
        size: line.size != null ? String(line.size) : null,
        quantity: Math.max(1, Math.min(99, Number(line.quantity) || 1)),
        priceSnapshot: Number.isFinite(Number(line.priceSnapshot)) ? Number(line.priceSnapshot) : null,
        addedAt: typeof line.addedAt === 'string' ? line.addedAt : null,
      }));
  } catch {
    return [];
  }
}

export function saveStoredCart(lines: CartLine[]): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    /* storage full or blocked — the cart still works for this session */
  }
}

function findVariant(product: Product, variantId: string | null, size: string | null): Variant | undefined {
  if (variantId) return product.variants.find((v) => v.id === variantId);
  if (size) return product.variants.find((v) => v.size === size);
  return undefined;
}

/** Revalidate stored lines against current inventory and prices. */
export function revalidateCart(lines: CartLine[], products: Product[]): RevalidatedLine[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  return lines.map((line) => {
    const key = cartLineKey(line.productId, line.variantId, line.size);
    const product = byId.get(line.productId) ?? null;
    if (!product) {
      return { ...line, key, product: null, status: 'unavailable', issue: 'This product is no longer in the catalog.' };
    }
    if (!product.published || product.verificationStatus !== 'verified' || product.priceRwf === null) {
      return { ...line, key, product, status: 'unavailable', issue: 'This product is not currently available for order.' };
    }
    const variant = findVariant(product, line.variantId, line.size);
    if (!variant) {
      const label = line.size ? `Size ${line.size}` : 'This variant';
      return { ...line, key, product, status: 'unavailable', issue: `${label} is no longer available.` };
    }
    if (variant.stock === null) {
      const label = line.size ? `Size ${line.size}` : 'This variant';
      return {
        ...line,
        key,
        product,
        status: 'unavailable',
        issue: `${label} is listed, but local store availability has not been confirmed.`,
      };
    }
    if (variant.stock <= 0) {
      const label = line.size ? `Size ${line.size}` : 'This variant';
      return { ...line, key, product, status: 'unavailable', issue: `${label} is no longer available.` };
    }
    if (line.priceSnapshot != null && line.priceSnapshot !== product.priceRwf) {
      return {
        ...line,
        key,
        product,
        status: 'price_changed',
        issue: `Price changed from RWF ${line.priceSnapshot.toLocaleString('en-US')} to the current store price.`,
      };
    }
    return { ...line, key, product, status: 'ok', issue: null };
  });
}

export function cartQuantityCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
