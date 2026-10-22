/**
 * OWNER WORKFLOW — approve one exact candidate into store inventory.
 * -----------------------------------------------------------------------------
 * Usage:
 *   npm run import:approve -- \
 *     --providerProductId "1f27cf59-74c3-4ace-a94b-717b0c84465e" \
 *     --price 45000 \
 *     --category sneakers \
 *     --sizes "40:2,41:3,42:1" \
 *     [--colorway "White / Gold"] [--sizeSystem "EU"] [--featured] \
 *     [--arrivedAt "2026-09-12T00:00:00.000Z"] [--dry-run]
 *
 * Requires:
 *   - a configured KICKSDB_API_KEY (the provider record supplies name + image)
 *   - MongoDB (default mongodb://localhost:27017/robbie_shoes)
 *
 * The product is written with verificationStatus 'verified' and published only
 * when it has a real RWF price and variants. Otherwise it is saved unpublished
 * (pending) with its blockers printed.
 */
import { connectMongo, closeMongo } from '../db/mongo.js';
import { hasProviderKey } from '../config/env.js';
import { approveCandidate } from '../services/catalogService.js';
import { CATEGORIES, type Category } from '../models/product.js';
import { ProviderError } from '../provider/kicksdb.js';

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseSizes(input: string | undefined): { id: string; size: string; stock: number }[] {
  if (!input) return [];
  return input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [size, stockStr] = part.split(':');
      const stock = Number(stockStr ?? '0');
      return { id: `size-${(size ?? '').trim()}`, size: (size ?? '').trim(), stock: Number.isFinite(stock) ? stock : 0 };
    });
}

async function main() {
  const providerProductId = arg('providerProductId');
  const priceRaw = arg('price');
  const categoryRaw = arg('category');

  if (!providerProductId) {
    console.error('Missing --providerProductId (from the search output).');
    process.exitCode = 1;
    return;
  }
  if (!categoryRaw || !(CATEGORIES as readonly string[]).includes(categoryRaw)) {
    console.error(`Missing/invalid --category. Allowed: ${CATEGORIES.join(', ')}`);
    process.exitCode = 1;
    return;
  }
  if (!hasProviderKey()) {
    console.error('No KICKSDB_API_KEY configured — cannot fetch the verified provider record.');
    process.exitCode = 2;
    return;
  }

  // price is optional at import time: without it the product stays UNPUBLISHED.
  const priceRwf = priceRaw === undefined ? null : Number(priceRaw);
  if (priceRaw !== undefined && (!Number.isFinite(priceRwf) || (priceRwf as number) < 0)) {
    console.error('--price must be a non-negative number (RWF).');
    process.exitCode = 1;
    return;
  }

  try {
    await connectMongo();
    const { product, blockers } = await approveCandidate({
      providerProductId,
      priceRwf: priceRwf as number | null,
      category: categoryRaw as Category,
      variants: parseSizes(arg('sizes')),
      colorway: arg('colorway'),
      sizeSystem: arg('sizeSystem'),
      featured: flag('featured'),
      arrivedAt: arg('arrivedAt'),
      dryRun: flag('dry-run'),
    });

    console.log(flag('dry-run') ? 'DRY RUN — nothing written.\n' : 'Saved.\n');
    console.log(JSON.stringify(product, null, 2));
    if (blockers.length > 0) {
      console.log('\nNOT in the live catalog yet. Blockers:');
      blockers.forEach((b) => console.log(` - ${b}`));
    } else {
      console.log('\nPublished to the live catalog (verified, priced, with variants).');
    }
  } catch (err) {
    if (err instanceof ProviderError) console.error(`Provider error (${err.kind}): ${err.message}`);
    else console.error('Approval failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await closeMongo().catch(() => undefined);
  }
}

main();
