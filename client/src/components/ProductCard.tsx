import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import type { Product } from '../types/product';
import { categoryLabel, productLabel } from '../types/product';
import Price from './Price';
import ProductImage from './ProductImage';

/** A product card built from ONE validated record; name, images and price all
 *  come from the same object. No image-name joining by position. */
export default function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const displayName = productLabel(product);
  const firstAvailable = product.variants.find((v) => v.stock !== null && v.stock > 0) ?? null;
  const sizeText = product.variants.filter((v) => v.stock !== null && v.stock > 0).map((v) => v.size).join(', ');
  const sourceSizes = product.variants.filter((v) => v.stock === null).map((v) => v.size).join(', ');
  const alt = `${displayName} — ${product.colorway ?? categoryLabel(product.category)}`;

  return (
    <li className="product-card">
      <Link
        className="product-card__media"
        to={`/product/${product.id}`}
        aria-label={`View details for ${displayName}`}
      >
        <ProductImage src={product.imageUrl} alt={alt} className="product-card__image" />
      </Link>
      <div className="product-card__body">
        {product.featured && <span className="product-card__flag">Featured</span>}
        <h3 className="product-card__title">
          <Link to={`/product/${product.id}`}>{displayName}</Link>
        </h3>
        {product.colorway && <p className="product-card__colorway">{product.colorway}</p>}
        {product.sku && <p className="product-card__sku">SKU: {product.sku}</p>}
        <Price value={product.priceRwf} />
        {sizeText && <p className="product-card__sizes">Sizes: {sizeText}</p>}
        {sourceSizes && (
          <p className="product-card__sizes">Catalog sizes (confirm availability): {sourceSizes}</p>
        )}
        <div className="product-card__actions">
          <Link className="btn btn--ghost-dark btn--sm" to={`/product/${product.id}`}>
            View details
          </Link>
          {firstAvailable && (
            <button
              type="button"
              className="btn btn--gold btn--sm"
              onClick={() => add(product, firstAvailable, 1)}
            >
              Quick add {firstAvailable.size}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
