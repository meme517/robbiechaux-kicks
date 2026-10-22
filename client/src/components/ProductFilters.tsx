import { CATEGORY_LABELS, type Category } from '../types/product';
import type { ShopFilters } from '../services/catalogService';

interface FilterOptions {
  categories: string[];
  brands: string[];
  sizes: string[];
  priceMin: number;
  priceMax: number;
  hasArrivalDates: boolean;
}

interface ProductFiltersProps {
  options: FilterOptions;
  values: ShopFilters;
  onChange: (next: ShopFilters) => void;
  onReset: () => void;
  resultCount: number;
  showNewest: boolean;
}

/** Filter options are always derived from the actual published inventory. */
export default function ProductFilters({
  options,
  values,
  onChange,
  onReset,
  resultCount,
  showNewest,
}: ProductFiltersProps) {
  const set = (patch: Partial<ShopFilters>) => onChange({ ...values, ...patch });

  return (
    <section className="filters" aria-label="Product filters">
      <div className="filters__field">
        <label className="filters__label" htmlFor="filter-query">
          Search
        </label>
        <input
          id="filter-query"
          type="search"
          placeholder="Search name, brand or SKU"
          value={values.query}
          onChange={(e) => set({ query: e.target.value })}
        />
      </div>

      <div className="filters__field">
        <label className="filters__label" htmlFor="filter-category">
          Category
        </label>
        <select id="filter-category" value={values.category} onChange={(e) => set({ category: e.target.value })}>
          <option value="">All categories</option>
          {options.categories.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c as Category] ?? c}
            </option>
          ))}
        </select>
      </div>

      <div className="filters__field">
        <label className="filters__label" htmlFor="filter-brand">
          Brand
        </label>
        <select id="filter-brand" value={values.brand} onChange={(e) => set({ brand: e.target.value })}>
          <option value="">All brands</option>
          {options.brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <div className="filters__field">
        <label className="filters__label" htmlFor="filter-size">
          Size
        </label>
        <select id="filter-size" value={values.size} onChange={(e) => set({ size: e.target.value })}>
          <option value="">All sizes</option>
          {options.sizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="filters__field">
        <label className="filters__label" htmlFor="filter-price-min">
          Min price (RWF)
        </label>
        <input
          id="filter-price-min"
          type="number"
          inputMode="numeric"
          min={0}
          placeholder={String(options.priceMin)}
          value={values.priceMin}
          onChange={(e) => set({ priceMin: e.target.value })}
        />
      </div>

      <div className="filters__field">
        <label className="filters__label" htmlFor="filter-price-max">
          Max price (RWF)
        </label>
        <input
          id="filter-price-max"
          type="number"
          inputMode="numeric"
          min={0}
          placeholder={String(options.priceMax)}
          value={values.priceMax}
          onChange={(e) => set({ priceMax: e.target.value })}
        />
      </div>

      <div className="filters__field">
        <label className="filters__label" htmlFor="filter-sort">
          Sort
        </label>
        <select id="filter-sort" value={values.sort} onChange={(e) => set({ sort: e.target.value })}>
          <option value="featured">Featured</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="name-asc">Name: A–Z</option>
          {showNewest && <option value="newest">Newest arrivals</option>}
        </select>
      </div>

      <p className="filters__result" role="status" aria-live="polite">
        {resultCount} {resultCount === 1 ? 'product' : 'products'}
      </p>
      <button type="button" className="btn btn--ghost-dark btn--block" onClick={onReset}>
        Reset filters
      </button>
    </section>
  );
}
