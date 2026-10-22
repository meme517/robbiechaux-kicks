import type { Product } from '../types/product';
import ProductCard from './ProductCard';

interface ProductGridProps {
  products: Product[];
  emptyFallback?: React.ReactNode;
}

/** Responsive card grid: 4 / 3 / 2 / 1-2 columns by breakpoint. */
export default function ProductGrid({ products, emptyFallback = null }: ProductGridProps) {
  if (products.length === 0) return <>{emptyFallback}</>;
  return (
    <ul className="product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </ul>
  );
}
