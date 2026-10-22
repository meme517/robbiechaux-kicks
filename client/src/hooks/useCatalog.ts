import { useEffect, useState } from 'react';
import { getCatalog, isDemoMode, peekCatalog } from '../services/catalogService';
import type { CatalogMeta, Product } from '../types/product';

export interface CatalogState {
  status: 'loading' | 'ready' | 'error';
  products: Product[];
  meta: CatalogMeta | null;
  error: string | null;
}

/** Shared catalog hook — every consumer reads the same cached snapshot. */
export function useCatalog(): CatalogState & { isDemo: boolean } {
  const [state, setState] = useState<CatalogState>(() => {
    const cached = peekCatalog();
    return cached
      ? { status: 'ready', products: cached.products, meta: cached.meta, error: null }
      : { status: 'loading', products: [], meta: null, error: null };
  });

  useEffect(() => {
    let cancelled = false;
    if (!peekCatalog()) setState({ status: 'loading', products: [], meta: null, error: null });
    getCatalog()
      .then((snapshot) => {
        if (!cancelled) {
          setState({ status: 'ready', products: snapshot.products, meta: snapshot.meta, error: null });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            products: [],
            meta: null,
            error: error instanceof Error ? error.message : 'Something went wrong.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...state, isDemo: isDemoMode() };
}
