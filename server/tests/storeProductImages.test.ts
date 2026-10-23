import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { storeProductImagePath } from '../src/services/storeProductImages.js';

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

async function makeDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'store-product-images-'));
  tempDirectories.push(directory);
  return directory;
}

describe('storeProductImagePath', () => {
  it('resolves only supported image files by exact provider product ID', async () => {
    const directory = await makeDirectory();
    await writeFile(join(directory, 'shopping-abc.webp'), 'image');

    expect(storeProductImagePath('shopping-abc', directory)).toBe(
      '/images/products/shopping-abc.webp',
    );
  });

  it('returns null when the matching store photo is missing', async () => {
    expect(storeProductImagePath('shopping-missing', await makeDirectory())).toBeNull();
  });

  it('rejects path traversal in product IDs', async () => {
    const directory = await makeDirectory();
    await writeFile(join(directory, 'outside.jpg'), 'image');

    expect(storeProductImagePath('../outside', directory)).toBeNull();
  });
});
