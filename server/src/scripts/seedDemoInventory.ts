/**
 * DEMO SEED — clearly-labelled placeholder inventory for local development.
 * -----------------------------------------------------------------------------
 * Writes records with provider 'store' and DISTINCT demo IDs prefixed
 * "demo:" so they are trivially separable from production inventory. Prices are
 * made-up RWF values. Images are the generated placeholder SVGs from the client
 * (served at /images/products/*.svg) plus a placeholder marker.
 *
 * OWNER: never seed demo data into a production database. Delete demo records
 * (id starts with "demo:") before going live.
 *
 * Usage: npm run seed:demo   (server workspace)
 */
import { connectMongo, closeMongo, productsCollection } from '../db/mongo.js';
import type { Product } from '../models/product.js';

const EU = [39, 40, 41, 42, 43, 44, 45];

function variants(sizes: number[], outOfStock: number[] = []) {
  return sizes.map((size) => ({
    id: `size-${size}`,
    size: String(size),
    stock: outOfStock.includes(size) ? 0 : 2,
  }));
}

function demoProduct(
  slug: string,
  name: string,
  brand: string | null,
  category: Product['category'],
  colorway: string,
  priceRwf: number,
  image: string,
  sizes: number[],
  outOfStock: number[] = [],
  featured = false,
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
    variants: variants(sizes, outOfStock),
    verificationStatus: 'verified',
    published: true,
    featured,
    arrivedAt: new Date().toISOString(),
    imageIsCatalogArt: false,
  };
}

const DEMO: Product[] = [
  demoProduct('court-low', 'Demo Court Low', 'Nike', 'sneakers', 'White / Gold', 45000, '/images/products/demo-court-low-white-gold.svg', EU, [39, 45], true),
  demoProduct('flight-high', 'Demo Flight High', 'Jordan', 'sneakers', 'Black / Red', 78000, '/images/products/demo-flight-high-black-red.svg', EU, [40], true),
  demoProduct('gel-runner', 'Demo Gel Runner', 'ASICS', 'sneakers', 'Grey / Navy', 55000, '/images/products/demo-gel-runner-grey-navy.svg', EU, [44]),
  demoProduct('classic-grey', 'Demo Classic Grey', 'New Balance', 'sneakers', 'Grey / Silver', 68000, '/images/products/demo-classic-grey-silver.svg', EU, [39, 41]),
  demoProduct('suede-strap', 'Demo Suede Strap', 'Puma', 'sneakers', 'Tan / Brown', 32000, '/images/products/demo-suede-strap-tan.svg', EU, [45]),
  demoProduct('air-court-mid', 'Demo Air Court Mid', 'Nike', 'sneakers', 'White / Red', 62000, '/images/products/demo-air-court-mid-white-red.svg', EU, [42], true),
  demoProduct('oxford', 'Demo Oxford Lace-Up', null, 'formal', 'Black', 38000, '/images/products/demo-oxford-black.svg', [39, 40, 41, 42, 43, 44], [41]),
  demoProduct('derby', 'Demo Derby Brown', null, 'formal', 'Brown', 36000, '/images/products/demo-derby-brown.svg', [39, 40, 41, 42, 43, 44]),
  demoProduct('penny-loafer', 'Demo Penny Loafer', null, 'loafers', 'Tan', 34000, '/images/products/demo-penny-loafer-tan.svg', [39, 40, 41, 42, 43, 44], [44], true),
  demoProduct('suede-loafer', 'Demo Suede Loafer', null, 'loafers', 'Navy', 35000, '/images/products/demo-suede-loafer-navy.svg', [39, 40, 41, 42, 43, 44], [40]),
  demoProduct('double-slide', 'Demo Double-Strap Slide', null, 'slides', 'Black', 18000, '/images/products/demo-double-slide-black.svg', [39, 40, 41, 42, 43, 44, 45, 46], [39]),
  demoProduct('clog', 'Demo Classic Clog', null, 'clogs', 'Cream', 22000, '/images/products/demo-clog-cream.svg', [38, 39, 40, 41, 42, 43, 44, 45], [45]),
];

async function main() {
  await connectMongo();
  const col = productsCollection();
  for (const product of DEMO) {
    // Drop undefined fields so MongoDB does not persist them as BSON null.
    const clean = Object.fromEntries(Object.entries(product).filter(([, v]) => v !== undefined));
    await col.updateOne({ id: product.id }, { $set: clean }, { upsert: true });
  }
  console.log(`Seeded ${DEMO.length} DEMO products (ids prefixed "demo:").`);
  console.log('These are placeholders, not confirmed store inventory.');
  await closeMongo();
}

main().catch(async (err) => {
  console.error('Seed failed:', err instanceof Error ? err.message : err);
  await closeMongo().catch(() => undefined);
  process.exitCode = 1;
});
