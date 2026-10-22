import { Link } from 'react-router-dom';
import { storeConfig } from '../config/storeConfig';
import { useCatalog } from '../hooks/useCatalog';
import { CATEGORIES, categoryLabel } from '../types/product';
import { storeWhatsappUrl } from '../utils/whatsapp';
import CategoryIcon from '../components/CategoryIcon';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import PageMeta from '../components/PageMeta';
import ProductGrid from '../components/ProductGrid';

const CTA_MESSAGE = `Hello ${storeConfig.storeName}! I would like to see what shoes you have available.`;

export default function Home() {
  const { status, products, meta, error, isDemo } = useCatalog();

  const featured = products.filter((p) => p.featured).slice(0, 4);
  const showcase = featured.length > 0 ? featured : products.slice(0, 4);
  return (
    <>
      <PageMeta
        title="Step in. Stand out."
        description="Robbiechaux Kicks — sneakers, running shoes, football boots, flats, heels, loafers, sandals, slides and boots in Kigali, Rwanda. Shop shoes and contact us on WhatsApp."
      />

      <section className="hero">
        <div className="container hero__inner">
          <div className="hero__copy">
            <p className="hero__eyebrow">{storeConfig.location.city}, Rwanda</p>
            <h1 className="hero__title">{storeConfig.storeName}</h1>
            <p className="hero__tagline">{storeConfig.tagline}</p>
            <p className="hero__sub">
              {storeConfig.secondaryTaglines[0]} Sneakers, flats, heels, loafers, boots and more
              delivered to {storeConfig.delivery.area}.
            </p>
            <div className="hero__actions">
              <Link className="btn btn--gold btn--lg" to="/shop">
                Shop shoes
              </Link>
              <a
                className="btn btn--outline-light btn--lg"
                href={storeWhatsappUrl(CTA_MESSAGE)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Contact on WhatsApp
              </a>
            </div>
          </div>

          <div className="hero__art" aria-hidden="true">
            <div className="hero__art-ring" />
            <img className="hero__art-shoe" src={storeConfig.logoPath} alt="" />
            <span className="hero__art-word">{storeConfig.secondaryTaglines[1]}</span>
          </div>
        </div>
      </section>

      <div className="marquee" aria-hidden="true">
        <span>{storeConfig.secondaryTaglines[1]}</span>
        <span aria-hidden="true">•</span>
        <span>{storeConfig.tagline}</span>
        <span aria-hidden="true">•</span>
        <span>{storeConfig.secondaryTaglines[0]}</span>
      </div>

      <section className="section">
        <div className="container">
          <header className="section__head">
            <h2 className="section__title">Featured kicks</h2>
            <Link className="section__link" to="/shop">
              View all →
            </Link>
          </header>

          {status === 'loading' && <LoadingState />}
          {status === 'error' && <ErrorState message={error} onRetry={() => window.location.reload()} />}
          {status === 'ready' && showcase.length === 0 && (
            <EmptyState
              title="Catalog setup pending"
              message={meta?.catalogMessage ?? 'Verified products are being prepared.'}
            />
          )}
          {status === 'ready' && showcase.length > 0 && (
            <>
              <ProductGrid products={showcase} />
              <p className="fine-print">
                {isDemo
                  ? 'Preview catalog — names, images and prices above are demo placeholders.'
                  : meta?.imageUseApproved
                    ? 'All products listed are published store inventory.'
                    : 'Published store inventory. Product imagery is provider catalog art, not a photo of local stock.'}
              </p>
              {!isDemo && meta?.imageAttribution && (
                <p className="fine-print">{meta.imageAttribution}</p>
              )}
            </>
          )}
        </div>
      </section>

      <section className="section section--tint">
        <div className="container">
          <header className="section__head">
            <h2 className="section__title">Shop by category</h2>
          </header>
          <ul className="category-tiles">
            {CATEGORIES.map((category) => (
              <li key={category}>
                <Link className="category-tile" to={`/shop?category=${encodeURIComponent(category)}`}>
                  <CategoryIcon category={category} />
                  <span className="category-tile__name">{categoryLabel(category)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="container split">
          <div className="split__copy">
            <h2 className="section__title">A Kigali shoe store with a loud identity</h2>
            <p>
              Robbiechaux Kicks is a footwear store in {storeConfig.location.label}. Our range covers
              sneakers, flats, heels, loafers, boots, sandals and more — pairs for everyday wear, work
              and going out.
            </p>
            <p>
              We deliver to {storeConfig.delivery.area}. Availability, delivery charges and final
              totals are always confirmed directly by the store.
            </p>
            <div className="hero__actions">
              <Link className="btn btn--dark" to="/about">
                About the store
              </Link>
              <Link className="btn btn--ghost-dark" to="/contact">
                Contact us
              </Link>
            </div>
          </div>

          <aside className="split__panel">
            <h3 className="split__panel-title">Visit or message us</h3>
            <p>{storeConfig.location.label}</p>
            <p>
              <a href={`tel:${storeConfig.phones.primary.international}`}>
                {storeConfig.phones.primary.label}
              </a>{' '}
              <span className="muted">(primary / WhatsApp)</span>
            </p>
            <p>
              <a href={`tel:${storeConfig.phones.secondary.international}`}>
                {storeConfig.phones.secondary.label}
              </a>
            </p>
            <p>
              <a href={storeConfig.instagram.url} target="_blank" rel="noopener noreferrer">
                {storeConfig.instagram.handle}
              </a>
            </p>
            <a
              className="btn btn--gold btn--block"
              href={storeWhatsappUrl(CTA_MESSAGE)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Message the store
            </a>
          </aside>
        </div>
      </section>
    </>
  );
}
