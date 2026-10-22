/**
 * =============================================================================
 * STORE CONFIGURATION (server copy of the owner-editable business details)
 * -----------------------------------------------------------------------------
 * The browser has its own copy in client/src/config/storeConfig.ts for display
 * (phone links, taglines, etc.). This server copy exists so the API can embed
 * the same facts in responses/attribution without trusting the client.
 * Keep both in sync; neither invents an email or street address.
 * =============================================================================
 */

export const storeConfig = {
  storeName: 'Robbiechaux Kicks',
  tagline: 'Step in. Stand out.',
  secondaryTaglines: ['New kicks, low prices!', 'Step loud, stay fresh!'],
  instagram: { handle: '@robbiechaux.kicks', url: 'https://www.instagram.com/robbiechaux.kicks/' },
  location: 'Downtown, Room L3-51, Kigali, Rwanda',
  phones: {
    primary: { label: '+250 793 314 037', international: '+250793314037', whatsapp: '250793314037' },
    secondary: { label: '+250 723 437 804', international: '+250723437804' },
  },
  deliveryArea: 'Kigali and nearby areas',
  currency: 'RWF',
  developerCredit: 'Website developed by TETERO NSANZE Arnold',
  /** Explicit placeholder — never turned into a mailto: link until replaced. */
  email: '[STORE_EMAIL]',
} as const;

export type StoreConfig = typeof storeConfig;
