import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  cartLineKey,
  cartQuantityCount,
  loadStoredCart,
  revalidateCart,
  saveStoredCart,
  type CartLine,
  type RevalidatedStatus,
} from '../utils/cart';
import { getCatalog, peekCatalog, subscribeCatalog } from '../services/catalogService';
import type { Product, Variant } from '../types/product';
import { productLabel } from '../types/product';

/** A cart line enriched with the current catalog product (when still present). */
export interface CartItem extends CartLine {
  key: string;
  name: string;
  brand?: string;
  sku?: string | null;
  providerProductId?: string;
  imageUrl: string;
  priceRwf: number | null;
}

export interface CartIssue {
  status: RevalidatedStatus;
  issue: string | null;
}

interface CartContextValue {
  lines: CartLine[];
  items: CartItem[];
  /** Per-line revalidation results (price changes / unavailable items). */
  issues: Record<string, CartIssue>;
  add: (product: Product, variant: Variant | null, quantity?: number) => void;
  setQuantity: (productId: string, variantId: string | null, size: string | null, quantity: number) => void;
  remove: (productId: string, variantId: string | null, size: string | null) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeByKey: (key: string) => void;
  clear: () => void;
  count: number;
  subtotalRwf: number;
  announcement: string;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => loadStoredCart());
  const [announcement, setAnnouncement] = useState('');
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(
    () => peekCatalog()?.products ?? [],
  );
  // Lines are only revalidated once a real catalog snapshot exists — otherwise
  // every stored line would be falsely flagged as "no longer in the catalog".
  const [catalogLoaded, setCatalogLoaded] = useState(() => peekCatalog() !== null);

  useEffect(() => {
    saveStoredCart(lines);
  }, [lines]);

  useEffect(() => {
    const unsubscribe = subscribeCatalog((snapshot) => {
      setCatalogProducts(snapshot.products);
      setCatalogLoaded(true);
    });
    // Ensure the catalog is requested even when the cart page is opened first
    // (deep link / refresh) so stored lines can resolve against real products.
    getCatalog().catch(() => {
      /* pages surface load errors; the cart keeps its stored lines */
    });
    return unsubscribe;
  }, []);

  const add = useCallback((product: Product, variant: Variant | null, quantity = 1) => {
    const variantId = variant?.id ?? null;
    const size = variant?.size ?? null;
    setLines((prev) => {
      const key = cartLineKey(product.id, variantId, size);
      const existing = prev.find((l) => cartLineKey(l.productId, l.variantId, l.size) === key);
      if (existing) {
        return prev.map((l) =>
          cartLineKey(l.productId, l.variantId, l.size) === key
            ? { ...l, quantity: Math.min(99, l.quantity + quantity), priceSnapshot: product.priceRwf }
            : l,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          variantId,
          size,
          quantity,
          priceSnapshot: product.priceRwf,
          addedAt: new Date().toISOString(),
        },
      ];
    });
    setAnnouncement(`${product.name}${size ? ` (size ${size})` : ''} added to cart.`);
  }, []);

  const setQuantity = useCallback(
    (productId: string, variantId: string | null, size: string | null, quantity: number) => {
      const q = Math.max(0, Math.min(99, Number(quantity) || 0));
      setLines((prev) => {
        if (q === 0) {
          return prev.filter(
            (l) => cartLineKey(l.productId, l.variantId, l.size) !== cartLineKey(productId, variantId, size),
          );
        }
        return prev.map((l) =>
          cartLineKey(l.productId, l.variantId, l.size) === cartLineKey(productId, variantId, size)
            ? { ...l, quantity: q }
            : l,
        );
      });
      setAnnouncement(q === 0 ? 'Item removed from cart.' : `Quantity updated to ${q}.`);
    },
    [],
  );

  const remove = useCallback((productId: string, variantId: string | null, size: string | null) => {
    setLines((prev) =>
      prev.filter((l) => cartLineKey(l.productId, l.variantId, l.size) !== cartLineKey(productId, variantId, size)),
    );
    setAnnouncement('Item removed from cart.');
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setAnnouncement('Cart emptied.');
  }, []);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    const q = Math.max(1, Math.min(99, Number(quantity) || 1));
    setLines((prev) =>
      prev.map((l) => (cartLineKey(l.productId, l.variantId, l.size) === key ? { ...l, quantity: q } : l)),
    );
    setAnnouncement(`Quantity updated to ${q}.`);
  }, []);

  const removeByKey = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => cartLineKey(l.productId, l.variantId, l.size) !== key));
    setAnnouncement('Item removed from cart.');
  }, []);

  /** Resolve stored lines against the latest catalog snapshot for display. */
  const items = useMemo<CartItem[]>(() => {
    const byId = new Map(catalogProducts.map((p) => [p.id, p]));
    return lines.map((line) => {
      const product = byId.get(line.productId);
      return {
        ...line,
        key: cartLineKey(line.productId, line.variantId, line.size),
        name: product ? productLabel(product) : 'Item no longer in catalog',
        brand: product?.brand,
        sku: product?.sku ?? null,
        providerProductId: product?.providerProductId,
        imageUrl: product?.imageUrl ?? '',
        priceRwf: product ? product.priceRwf : line.priceSnapshot,
      };
    });
  }, [lines, catalogProducts]);

  const subtotalRwf = useMemo(
    () => items.reduce((sum, item) => sum + (item.priceRwf ?? 0) * item.quantity, 0),
    [items],
  );

  const issues = useMemo<Record<string, CartIssue>>(() => {
    if (!catalogLoaded) return {};
    const map: Record<string, CartIssue> = {};
    revalidateCart(lines, catalogProducts).forEach((line) => {
      if (line.status !== 'ok') map[line.key] = { status: line.status, issue: line.issue };
    });
    return map;
  }, [lines, catalogProducts, catalogLoaded]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      items,
      issues,
      add,
      setQuantity,
      remove,
      updateQuantity,
      removeByKey,
      clear,
      count: cartQuantityCount(lines),
      subtotalRwf,
      announcement,
    }),
    [lines, items, issues, add, setQuantity, remove, updateQuantity, removeByKey, clear, subtotalRwf, announcement],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- context + hook intentionally share a file
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>.');
  return ctx;
}
