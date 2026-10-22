import { Link } from 'react-router-dom';
import { hasRealEmail, storeConfig } from '../config/storeConfig';
import { storeWhatsappUrl } from '../utils/whatsapp';
import Logo from './Logo';

export default function Footer() {
  const year = new Date().getFullYear();
  const emailReady = hasRealEmail();

  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <Logo size="md" showName />
          <p className="site-footer__tagline">{storeConfig.tagline}</p>
          <p className="site-footer__pitch">{storeConfig.secondaryTaglines[0]}</p>
        </div>

        <nav className="site-footer__col" aria-label="Footer navigation">
          <h2 className="site-footer__heading">Explore</h2>
          <ul className="site-footer__links">
            <li><Link to="/">Home</Link></li>
            <li><Link to="/shop">Shop</Link></li>
            <li><Link to="/about">About</Link></li>
            <li><Link to="/faq">Delivery &amp; returns</Link></li>
            <li><Link to="/contact">Contact</Link></li>
            <li><Link to="/cart">Cart</Link></li>
          </ul>
        </nav>

        <div className="site-footer__col">
          <h2 className="site-footer__heading">Visit &amp; contact</h2>
          <address className="site-footer__address">
            <p>{storeConfig.location.label}</p>
            <p>
              <a href={`tel:${storeConfig.phones.primary.international}`}>
                {storeConfig.phones.primary.label} <span className="muted">(WhatsApp)</span>
              </a>
            </p>
            <p>
              <a href={`tel:${storeConfig.phones.secondary.international}`}>
                {storeConfig.phones.secondary.label}
              </a>
            </p>
            <p>
              Delivery:{' '}
              <a
                href={storeWhatsappUrl(
                  `Hello ${storeConfig.storeName}! Do you deliver to my area? I am in Kigali.`,
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp us
              </a>
            </p>
            <p>
              Instagram:{' '}
              <a href={storeConfig.instagram.url} target="_blank" rel="noopener noreferrer">
                {storeConfig.instagram.handle}
              </a>
            </p>
            {/* OWNER EDIT: replace [STORE_EMAIL] in client/src/config/storeConfig.ts */}
            <p className="site-footer__email">
              {emailReady ? (
                <a href={`mailto:${storeConfig.email}`}>{storeConfig.email}</a>
              ) : (
                <span className="muted">Email: {storeConfig.email} (to be added)</span>
              )}
            </p>
          </address>
        </div>

        <div className="site-footer__col">
          <h2 className="site-footer__heading">Delivery</h2>
          <p>{storeConfig.delivery.area}</p>
          <p className="muted">
            Delivery charges and timing are confirmed by the store — contact us for a quote.
          </p>
        </div>
      </div>

      <div className="container site-footer__bottom">
        <p>
          © {year} {storeConfig.storeName}. All rights reserved.
        </p>
        <p className="site-footer__credit">{storeConfig.developerCredit}</p>
      </div>
    </footer>
  );
}
