/**
 * OWNER WORKFLOW — import REAL product images from the catalog API.
 * -----------------------------------------------------------------------------
 * Replaces the locally-drawn placeholder SVGs with product photography fetched
 * from the configured catalog source (DummyJSON by default), so every card and
 * gallery shows an image that came from the API alongside its own name, brand,
 * SKU and price.
 *
 * Usage:
 *   npm run import:api                fetch + write
 *   npm run import:api -- --dry-run   fetch + print, write nothing
 *   npm run import:api -- --rate 1450 override the USD -> RWF conversion
 *   npm run import:api -- --keep-demo keep the demo:* placeholder records
 *
 * By default the demo:* placeholder records are deleted — they exist only to
 * exercise the UI before a real catalog exists.
 *
 * PRICES: the source publishes USD. This script derives an editable RWF figure
 * from USD_TO_RWF_RATE (default 1300, rounded to 500) so products can be
 * published at all. Treat them as a starting point and replace them with your
 * own selling prices via the admin API.
 */
import { connectMongo, closeMongo, productsCollection } from '../db/mongo.js';
import { config } from '../config/env.js';
import { fetchApiCatalog, type SkippedRecord } from '../provider/dummyjson.js';

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

const dryRun = process.argv.includes('--dry-run');
const keepDemo = process.argv.includes('--keep-demo');
const rate = Number(arg('rate') ?? config.catalog.usdToRwfRate);

function printRecord(p: { id: string; name: string; brand?: string; category: string; priceRwf: number | null; imageUrl: string; gallery: string[]; variants: { size: string; stock: number | null }[] }) {
  // Same guard the UI uses: source names already contain the brand.
  const label =
    p.brand && !p.name.toLowerCase().startsWith(p.brand.toLowerCase())
      ? `${p.brand} ${p.name}`
      : p.name;
  console.log(`  ${label}`);
  console.log(`    id: ${p.id}   category: ${p.category}   priceRwf: ${p.priceRwf}`);
  console.log(`    image: ${p.imageUrl}`);
  console.log(`    gallery: ${p.gallery.length} image(s)`);
  console.log(
    `    sizes: ${p.variants.map((v) => `${v.size}(${v.stock})`).join(' ')}`,
  );
}

async function main() {
  if (!Number.isFinite(rate) || rate <= 0) {
    console.error('Invalid --rate / USD_TO_RWF_RATE. Expected a positive number.');
    process.exitCode = 1;
    return;
  }

  console.log(`Fetching shoe catalog from ${config.catalog.baseUrl} ...`);
  const { products, skipped } = await fetchApiCatalog(rate);

  console.log(`\nFetched ${products.length} product record(s) with real images.`);
  products.forEach(printRecord);

  if (skipped.length > 0) {
    console.log(`\nSkipped ${skipped.length} record(s) (not guessed into a category):`);
    printSkipped(skipped);
  }

  if (dryRun) {
    console.log('\nDry run — nothing written.');
    return;
  }

  await connectMongo();
  const col = productsCollection();

  const removedPlaceholders = await col.deleteMany({ id: /^demo:/ });
  const removedPrevious = await col.deleteMany({ id: /^dummyjson:/ });

  let written = 0;
  for (const product of products) {
    // importMeta is intentionally NOT part of productSchema; strip undefined
    // values the same way the demo seeder does so Mongo stores no loose nulls.
    const clean = Object.fromEntries(
      Object.entries(product).filter(([, v]) => v !== undefined),
    );
    await col.updateOne({ id: product.id }, { $set: clean }, { upsert: true });
    written += 1;
  }

  console.log(
    `\nWrote ${written} product(s) with API-sourced images to ${config.mongo.dbName}.`,
  );
  console.log(
    `Removed ${removedPrevious.deletedCount} previous API import(s)` +
      (keepDemo
        ? ' (demo placeholders kept).'
        : ` and ${removedPlaceholders.deletedCount} demo placeholder record(s).`),
  );
  console.log(
    'Prices are converted from the source USD figures — replace them with your own RWF selling prices.',
  );
}

function printSkipped(list: SkippedRecord[]) {
  for (const s of list) {
    console.log(`  #${s.id} ${s.title} — ${s.reason}`);
  }
}

main()
  .catch(async (err) => {
    console.error('\nImport failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongo().catch(() => undefined);
  });
