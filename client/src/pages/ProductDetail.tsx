import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { storeConfig } from '../config/storeConfig';
import { useCart } from '../context/CartContext';
import { useCatalog } from '../hooks/useCatalog';
import { categoryLabel, productLabel, type Product } from '../types/product';
import { productOrderMessage, storeWhatsappUrl } from '../utils/whatsapp';
import { formatRWF } from '../utils/currency';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import PageMeta from '../components/PageMeta';
import Price from '../components/Price';
import ProductGrid from '../components/ProductGrid';
import ProductImage from '../components/ProductImage';
import SizePicker from '../components/SizePicker';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { status, products, error, isDemo } = useCatalog();
  const { add } = useCart();

  const product = useMemo(() => products.find((p) => p.id === id) ?? null, [products, id]);
  const related = useMemo(() => {
    if (!product) return [] as Product[];
    const same = products.filter((p) => p.id !== product.id && p.category === product.category);
    const rest = products.filter((p) => p.id !== product.id && p.category !== product.category);
    return [...same, ...rest].slice(0, 4);
  }, [product, products]);

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    setSelectedSize(null);
    setActiveImage(0);
    setFeedback('');
  }, [id]);

  if (status === 'loading') {
    return (
      <div className="container page">
        <PageMeta title="Loading product…" />
        <LoadingState label="Loading product…" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="container page">
        <PageMeta title="Error" />
        <ErrorState message={error} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container page">
        <PageMeta title="Product not found" />
        <div className="state-panel state-panel--empty" role="alert">
          <h1 className="state-panel__title">Product not found</h1>
          <p>
            This product ID does not match any published item in the catalog. It may have been
            unpublished or the link may be incorrect.
          </p>
          <div className="state-panel__actions">
            <Link className="btn btn--gold" to="/shop">
              Continue shopping
            </Link>
            <Link className="btn btn--ghost-dark" to="/contact">
              Contact the store
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const displayName = productLabel(product);
  const availableVariants = product.variants.filter((v) => v.stock > 0);
  const needsSize = product.variants.length > 0;
  const selectedVariant = product.variants.find((v) => v.size === selectedSize && v.stock > 0) ?? null;
  const sizeReady = !needsSize || selectedVariant !== null;
  const canOrder = product.priceRwf !== null && availableVariants.length > 0;
  const gallery = product.gallery.length > 0 ? product.gallery : [product.imageUrl];
  const alt = `${displayName} — ${product.colorway ?? categoryLabel(product.category)}`;

  const handleAdd = () => {
    if (!sizeReady) {
      setFeedback('Please select an available size before adding this item to your cart.');
      return;
    }
    add(product, selectedVariant, 1);
    setFeedback(`${displayName}${selectedSize ? `, size ${selectedSize}` : ''} added to your cart.`);
  };

  return (
    <div className="container page">
      <PageMeta
        title={displayName}
        description={`${displayName}${product.colorway ? ` — ${product.colorway}` : ''} at Robbiechaux Kicks, Kigali. Price ${formatRWF(product.priceRwf)}. Delivery to Kigali and nearby areas.`}
      />

      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link to="/shop">Shop</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{displayName}</span>
      </nav>

      <div className="product-detail">
        <div className="product-detail__gallery">
          <ProductImage src={gallery[activeImage]} alt={alt} lazy={false} className="product-detail__main-image" />
          {gallery.length > 1 && (
            <ul className="product-detail__thumbs">
              {gallery.map((src, index) => (
                <li key={`${src}-${index}`}>
                  <button
                    type="button"
                    className={`product-detail__thumb ${index === activeImage ? 'is-active' : ''}`}
                    onClick={() => setActiveImage(index)}
                    aria-label={`View image ${index + 1} of ${gallery.length}`}
                    aria-current={index === activeImage}
                  >
                    <ProductImage src={src} alt="" width={96} height={72} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="product-detail__info">
          {product.featured && <span className="tag tag--dark">Featured</span>}
          <h1 className="product-detail__title">{displayName}</h1>

          <p className="product-detail__meta">
            {product.brand && <span>Brand: {product.brand}</span>}
            {product.colorway && <span>Colorway: {product.colorway}</span>}
            {product.sku && <span>SKU: {product.sku}</span>}
            <span>Category: {categoryLabel(product.category)}</span>
          </p>

          <div className="product-detail__price-row">
            <Price value={product.priceRwf} className="price--lg" />
            <span
              className={`stock-badge stock-badge--${availableVariants.length > 0 ? 'in_stock' : 'out_of_stock'}`}
            >
              {availableVariants.length > 0 ? 'Available in store' : 'Out of stock'}
            </span>
          </div>

          {product.variants.length > 0 && (
            <div id="sizes">
              <SizePicker
                variants={product.variants}
                value={selectedSize}
                onChange={(size) => {
                  setSelectedSize(size);
                  setFeedback(`Size ${size} selected.`);
                }}
                legend={availableVariants.length === 0 ? 'Select a size (none available)' : 'Select a size'}
              />
            </div>
          )}

          <div className="product-detail__actions">
            <button type="button" className="btn btn--gold btn--lg" onClick={handleAdd} disabled={!canOrder}>
              {canOrder ? 'Add to cart' : 'Unavailable'}
            </button>
            <a
              className="btn btn--outline-dark btn--lg"
              href={storeWhatsappUrl(productOrderMessage(product, selectedSize, 1, isDemo))}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!canOrder || !sizeReady) {
                  e.preventDefault();
                  setFeedback('Select an available size before ordering on WhatsApp.');
                }
              }}
            >
              Order on WhatsApp
            </a>
          </div>

          <p className="product-detail__feedback" role="status" aria-live="polite">
            {feedback}
          </p>

          <ul className="product-detail__assurances">
            <li>Availability and the final total are confirmed by the store.</li>
            <li>Delivery to {storeConfig.delivery.area}.</li>
            <li>Orders are arranged on WhatsApp — no online payment is taken on this site.</li>
          </ul>

          {product.sourceUrl && (
            <p className="fine-print">
              Product metadata source:{' '}
              <a href={product.sourceUrl} target="_blank" rel="noopener noreferrer">
                provider record
              </a>
              . {product.imageAttribution ?? ''}
            </p>
          )}
          {product.imageIsCatalogArt && (
            <p className="fine-print">
              Product imagery is provider catalog art — not a photograph of the store's physical stock.
            </p>
          )}
          {isDemo && (
            <p className="fine-print fine-print--demo">
              Demo record — this name, image and price are placeholders, not confirmed store inventory.
            </p>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="section">
          <header className="section__head">
            <h2 className="section__title">You may also like</h2>
          </header>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
