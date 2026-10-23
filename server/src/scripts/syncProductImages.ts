import { readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  closeMongo,
  connectMongo,
  productsCollection,
} from '../db/mongo.js';
import {
  STORE_PRODUCT_IMAGE_DIRECTORY,
  storeProductImagePath,
} from '../services/storeProductImages.js';
import type { Product } from '../models/product.js';

const SUPPORTED_IMAGE = /\.(webp|jpe?g|png)$/i;
const dryRun = process.argv.includes('--dry-run');
const manifestMode = process.argv.includes('--manifest');

function csv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function exportManifest(products: Product[]): Promise<void> {
  const output = resolve(process.cwd(), 'product-image-manifest.csv');
  const lines = [
    'product_name,provider_product_id,expected_filename',
    ...products.map((product) => {
      const id = product.providerProductId;
      if (!id) return null;
      return [
        csv(product.name),
        csv(id),
        csv(`${id}.jpg`),
      ].join(',');
    }).filter((line): line is string => line !== null),
  ];
  await writeFile(output, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Wrote ${lines.length - 1} product mappings to ${output}.`);
}

async function main(): Promise<void> {
  await connectMongo();
  const products = await productsCollection()
    .find({
      provider: 'serpapi',
      published: true,
      verificationStatus: 'verified',
    })
    .sort({ name: 1 })
    .toArray();

  if (manifestMode) {
    await exportManifest(products);
    return;
  }

  const files = await readdir(STORE_PRODUCT_IMAGE_DIRECTORY, { withFileTypes: true });
  const imageFiles = files
    .filter((file) => file.isFile() && SUPPORTED_IMAGE.test(file.name))
    .map((file) => file.name);
  const available = new Set<string>();
  for (const fileName of imageFiles) {
    const productId = fileName.replace(SUPPORTED_IMAGE, '');
    if (storeProductImagePath(productId)) available.add(productId);
  }

  let linked = 0;
  let missing = 0;
  for (const product of products) {
    const productId = product.providerProductId;
    if (!productId) continue;
    const imagePath = available.has(productId) ? storeProductImagePath(productId) : null;
    if (!imagePath) {
      missing += 1;
      continue;
    }
    console.log(`${dryRun ? 'READY' : 'LINKED'} ${product.name} -> ${imagePath}`);
    if (!dryRun) {
      await productsCollection().updateOne(
        { id: product.id, provider: 'serpapi' },
        {
          $set: {
            imageUrl: imagePath,
            gallery: [imagePath],
            imageIsCatalogArt: false,
          },
          $unset: { imageAttribution: '' },
        },
      );
    }
    linked += 1;
  }

  console.log(`${linked} image(s) ${dryRun ? 'ready to link' : 'linked'}; ${missing} product(s) still need a store photo.`);
  if (dryRun) console.log('Dry run — no product records were changed.');
}

main()
  .catch((error: unknown) => {
    console.error(
      'Store image sync failed:',
      error instanceof Error ? error.message : 'unknown error',
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongo();
  });
