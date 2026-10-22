import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import PageMeta from '../components/PageMeta';
import ProductFilters from '../components/ProductFilters';
import ProductGrid from '../components/ProductGrid';
import { useCatalog } from '../hooks/useCatalog';
import { deriveFilterOptions, filterAndSortProducts, type ShopFilters } from '../services/catalogService';

const PAGE_SIZE = 8;

const DEFAULT_FILTERS: ShopFilters = {
  query: '',
  category: '',
  brand: '',
  size: '',
  priceMin: '',
  priceMax: '',
  sort: 'featured',
};

export default function Shop() {
  const { status, products, meta, error, isDemo } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<ShopFilters>(() => ({
    ...DEFAULT_FILTERS,
    category: searchParams.get('category') || '',
  }));
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    const cat = searchParams.get('category') || '';
    setFilters((prev) => (prev.category === cat ? prev : { ...prev, category: cat }));
  }, [searchParams]);

  const onFiltersChange = (next: ShopFilters) => {
    setFilters(next);
    setVisible(PAGE_SIZE);
    const params = new URLSearchParams();
    if (next.category) params.set('category', next.category);
    setSearchParams(params, { replace: true });
  };

  const resetFilters = () => onFiltersChange(DEFAULT_FILTERS);

  const options = useMemo(() => deriveFilterOptions(products), [products]);
  const results = useMemo(() => filterAndSortProducts(products, filters), [products, filters]);
  const visibleResults = results.slice(0, visible);

  const isEmptyCatalog = status === 'ready' && products.length === 0;
  const noResults = status === 'ready' && products.length > 0 && results.length === 0;

  return (
    <div className="container page">
      <PageMeta
        title="Shop"
        description="Browse shoes at Robbiechaux Kicks — search by name, brand or SKU, filter by category, size and RWF price range. Kigali, Rwanda."
      />

      <header className="page__head">
        <h1 className="page__title">Shop</h1>
        <p className="page__lead">
          {isDemo
            ? 'Preview catalog — every record below is a clearly labelled demo placeholder, not confirmed store inventory.'
            : (meta?.catalogMessage ?? 'Published store inventory. Prices are in Rwandan francs (RWF).')}
        </p>
      </header>

      {status === 'loading' && <LoadingState label="Loading the catalog…" />}
      {status === 'error' && <ErrorState message={error} />}

      {isEmptyCatalog && (
        <EmptyState
          title="Catalog setup pending"
          message={
            meta?.catalogMessage ??
            'Verified products have not been published yet. Contact the store to hear what is currently available.'
          }
        />
      )}

      {status === 'ready' && products.length > 0 && (
        <div className="shop-layout">
          <ProductFilters
            options={options}
            values={filters}
            onChange={onFiltersChange}
            onReset={resetFilters}
            resultCount={results.length}
            showNewest={options.hasArrivalDates}
          />

          <div className="shop-results">
            {noResults ? (
              <EmptyState
                title="No products match your filters"
                message="Try a different search term, category, size or price range."
              >
                <button type="button" className="btn btn--gold" onClick={resetFilters}>
                  Reset filters
                </button>
              </EmptyState>
            ) : (
              <>
                <ProductGrid products={visibleResults} />
                {visible < results.length && (
                  <div className="load-more">
                    <button type="button" className="btn btn--dark" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                      Load more ({results.length - visible} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
