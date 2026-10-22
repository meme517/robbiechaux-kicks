/**
 * =============================================================================
 * DEMO CATALOG — NOT REAL INVENTORY (client-only, opt-in via VITE_CATALOG_MODE=demo)
 * -----------------------------------------------------------------------------
 * Names are neutral demo labels, images are generated placeholder art, prices
 * are made-up RWF values. Brand names are placeholder labels only — no brand
 * partnership or authenticity is claimed. Demo orders are marked as demos.
 * =============================================================================
 */
import type { Product } from '../types/product';

const EU = [39, 40, 41, 42, 43, 44, 45];

function variants(sizes: number[], outOfStock: number[] = []) {
  return sizes.map((size) => ({
    id: `size-${size}`,
    size: String(size),
    stock: outOfStock.includes(size) ? 0 : 2,
  }));
}

function demo(
  slug: string,
  name: string,
  brand: string | null,
  category: Product['category'],
  colorway: string,
  priceRwf: number,
  image: string,
  featured = false,
  outOfStock: number[] = [],
): Product {
  return {
    id: `demo:${slug}`,
    provider: 'store',
    sku: `DEMO-${slug.toUpperCase()}`,
    name,
    brand: brand ?? undefined,
    colorway,
    category,
    imageUrl: image,
    gallery: [image],
    priceRwf,
    sizeSystem: 'EU',
    variants: variants(EU, outOfStock),
    verificationStatus: 'verified',
    published: true,
    featured,
    arrivedAt: '2026-09-12T00:00:00.000Z',
    imageIsCatalogArt: false,
  };
}

export const demoCatalog: Product[] = [
  demo('court-low', 'Demo Court Low', 'Nike', 'sneakers', 'White / Gold', 45000, '/images/products/demo-court-low-white-gold.svg', true, [39, 45]),
  demo('flight-high', 'Demo Flight High', 'Jordan', 'sneakers', 'Black / Red', 78000, '/images/products/demo-flight-high-black-red.svg', true, [40]),
  demo('gel-runner', 'Demo Gel Runner', 'ASICS', 'sneakers', 'Grey / Navy', 55000, '/images/products/demo-gel-runner-grey-navy.svg', false, [44]),
  demo('classic-grey', 'Demo Classic Grey', 'New Balance', 'sneakers', 'Grey / Silver', 68000, '/images/products/demo-classic-grey-silver.svg', false, [39, 41]),
  demo('suede-strap', 'Demo Suede Strap', 'Puma', 'sneakers', 'Tan / Brown', 32000, '/images/products/demo-suede-strap-tan.svg', false, [45]),
  demo('air-court-mid', 'Demo Air Court Mid', 'Nike', 'sneakers', 'White / Red', 62000, '/images/products/demo-air-court-mid-white-red.svg', true, [42]),
  demo('oxford', 'Demo Oxford Lace-Up', null, 'formal', 'Black', 38000, '/images/products/demo-oxford-black.svg', false, [41]),
  demo('derby', 'Demo Derby Brown', null, 'formal', 'Brown', 36000, '/images/products/demo-derby-brown.svg'),
  demo('penny-loafer', 'Demo Penny Loafer', null, 'loafers', 'Tan', 34000, '/images/products/demo-penny-loafer-tan.svg', true, [44]),
  demo('suede-loafer', 'Demo Suede Loafer', null, 'loafers', 'Navy', 35000, '/images/products/demo-suede-loafer-navy.svg', false, [40]),
  demo('double-slide', 'Demo Double-Strap Slide', null, 'slides', 'Black', 18000, '/images/products/demo-double-slide-black.svg', false, [39]),
  demo('clog', 'Demo Classic Clog', null, 'clogs', 'Cream', 22000, '/images/products/demo-clog-cream.svg', false, [45]),
];
