/**
 * OWNER WORKFLOW — search for candidate products (read-only).
 * -----------------------------------------------------------------------------
 * Usage:
 *   npm run import:search -- --query "DZ5485-100"
 *   npm run import:search -- --query "Nike Dunk Low"
 *
 * Prints provider candidates WITH their provider product ID, SKU and image so
 * the owner can verify an EXACT match (model, colorway, size/gender variant)
 * using a box label, source link or original store photo before approving.
 *
 * A search result is a CANDIDATE, never automatic approval.
 */
import { closeMongo } from '../db/mongo.js';
import { hasProviderKey } from '../config/env.js';
import { searchProviderProducts, ProviderError } from '../provider/kicksdb.js';

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const query = arg('query');
  if (!query) {
    console.error('Usage: npm run import:search -- --query "<SKU or name>"');
    process.exitCode = 1;
    return;
  }
  if (!hasProviderKey()) {
    console.error(
      'No KICKSDB_API_KEY configured. Set it in server/.env (see .env.example) before searching.\n' +
        'This is an honest failure: no live provider request was attempted.',
    );
    process.exitCode = 2;
    return;
  }

  try {
    const candidates = await searchProviderProducts(query);
    if (candidates.length === 0) {
      console.log(`No provider candidates matched "${query}".`);
      return;
    }
    console.log(`Found ${candidates.length} candidate(s) for "${query}":\n`);
    candidates.forEach((c, i) => {
      console.log(`${i + 1}. ${c.name}`);
      console.log(`   providerProductId: ${c.providerProductId}`);
      console.log(`   brand: ${c.brand ?? '(none)'}   sku: ${c.sku ?? '(none)'}`);
      console.log(`   image: ${c.imageUrl}`);
      console.log(`   source: ${c.sourceUrl ?? '(none)'}`);
      console.log('');
    });
    console.log(
      'Review these carefully. Approve only an EXACT match:\n' +
        '  npm run import:approve -- --providerProductId "<id>" --sku "<sku>" \\\n' +
        '    --price 45000 --category sneakers --sizes "40:2,41:3,42:1"\n' +
        'Prices are the OWNER\'S selling prices in RWF, not provider USD prices.',
    );
  } catch (err) {
    if (err instanceof ProviderError) {
      console.error(`Provider error (${err.kind}): ${err.message}`);
    } else {
      console.error('Search failed:', err instanceof Error ? err.message : err);
    }
    process.exitCode = 1;
  } finally {
    await closeMongo().catch(() => undefined);
  }
}

main();
