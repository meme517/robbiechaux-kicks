import { Outlet, useLocation } from 'react-router-dom';
import { storeConfig } from '../config/storeConfig';
import { useCart } from '../context/CartContext';
import { isDemoMode } from '../services/catalogService';
import DemoBanner from './DemoBanner';
import Footer from './Footer';
import Header from './Header';
import ScrollToTop from './ScrollToTop';
import WhatsAppFab from './WhatsAppFab';

export default function Layout() {
  const { announcement } = useCart();
  const { pathname } = useLocation();

  return (
    <div className="app-shell">
      <ScrollToTop />
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Header />
      {isDemoMode() && <DemoBanner />}
      <main id="main-content" className="site-main" key={pathname}>
        <Outlet />
      </main>
      <Footer />
      <WhatsAppFab />
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>
      <span className="sr-only">{storeConfig.storeName}</span>
    </div>
  );
}
