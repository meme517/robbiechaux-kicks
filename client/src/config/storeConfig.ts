/**
 * =============================================================================
 * OWNER-EDITABLE STORE CONFIGURATION (client display copy)
 * -----------------------------------------------------------------------------
 * This file holds the confirmed business details used for display and links.
 * Keep it in sync with server/src/config/store.ts (used for API responses).
 * Do not invent an email, street address, hours or coordinates.
 * =============================================================================
 */

export const STORE_EMAIL_PLACEHOLDER = '[STORE_EMAIL]';

export interface PhoneEntry {
  label: string;
  international: string;
  whatsapp?: string;
}

export interface StoreConfig {
  storeName: string;
  tagline: string;
  secondaryTaglines: string[];
  instagram: { handle: string; url: string };
  location: { label: string; city: string; country: string };
  phones: { primary: PhoneEntry; secondary: PhoneEntry };
  delivery: { area: string; charges: string | null; timing: string | null };
  email: string;
  logoPath: string;
  currency: string;
  developerCredit: string;
  catalog: { mode: 'api' | 'demo' };
  promotions: {
    backToSchool20: {
      enabled: boolean;
      label: string;
      startsAt: string | null;
      endsAt: string | null;
      appliesTo: string[];
    };
  };
  policies: {
    deliveryCharges: string | null;
    deliveryTiming: string | null;
    paymentMethods: string | null;
    returns: string | null;
  };
  contactForm: { provider: string | null; endpoint: string | null };
}

const envCatalogMode = (import.meta.env.VITE_CATALOG_MODE as string | undefined) === 'demo' ? 'demo' : 'api';

export const storeConfig: StoreConfig = {
  storeName: 'Robbiechaux Kicks',
  tagline: 'Step in. Stand out.',
  secondaryTaglines: ['New kicks, low prices!', 'Step loud, stay fresh!'],
  instagram: {
    handle: '@robbiechaux.kicks',
    url: 'https://www.instagram.com/robbiechaux.kicks/',
  },
  location: {
    label: 'Downtown, Room L3-51, Kigali, Rwanda',
    city: 'Kigali',
    country: 'Rwanda',
  },
  phones: {
    primary: { label: '+250 793 314 037', international: '+250793314037', whatsapp: '250793314037' },
    secondary: { label: '+250 723 437 804', international: '+250723437804' },
  },
  delivery: {
    area: 'Kigali and nearby areas',
    charges: null, // OWNER: set once delivery charges are confirmed
    timing: null, // OWNER: set once delivery timing is confirmed
  },
  email: STORE_EMAIL_PLACEHOLDER, // OWNER: replace with the real address
  logoPath: '/images/logo.png', // OWNER: drop the logo file here
  currency: 'RWF',
  developerCredit: 'Website developed by TETERO NSANZE Arnold',
  catalog: {
    /**
     * 'api'  -> read verified inventory from our backend (default Phase 2)
     * 'demo' -> clearly-labelled demo records; never sends real orders
     */
    mode: envCatalogMode,
  },
  promotions: {
    backToSchool20: {
      enabled: false,
      label: '20% back-to-school discount',
      startsAt: null,
      endsAt: null,
      appliesTo: [],
    },
  },
  policies: {
    deliveryCharges: null,
    deliveryTiming: null,
    paymentMethods: null,
    returns: null,
  },
  /** OWNER: the API reports the real availability at runtime (GET /api/contact/status). */
  contactForm: { provider: null, endpoint: null },
};

export function hasRealEmail(email: string = storeConfig.email): boolean {
  const trimmed = email.trim();
  if (!trimmed || trimmed === STORE_EMAIL_PLACEHOLDER) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function isPromotionActive(promo: StoreConfig['promotions']['backToSchool20']): boolean {
  if (!promo.enabled || !promo.startsAt || !promo.endsAt) return false;
  const now = Date.now();
  return now >= Date.parse(promo.startsAt) && now <= Date.parse(promo.endsAt);
}

export default storeConfig;
