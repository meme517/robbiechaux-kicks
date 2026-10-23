import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const IMAGE_EXTENSIONS = ['.webp', '.jpg', '.jpeg', '.png'] as const;

export const STORE_PRODUCT_IMAGE_DIRECTORY = resolve(
  process.cwd(),
  '../client/public/images/products',
);

export function storeProductImagePath(
  providerProductId: string,
  directory = STORE_PRODUCT_IMAGE_DIRECTORY,
): string | null {
  if (!/^[a-z0-9-]+$/i.test(providerProductId)) return null;

  for (const extension of IMAGE_EXTENSIONS) {
    const fileName = `${providerProductId}${extension}`;
    if (existsSync(resolve(directory, fileName))) {
      return `/images/products/${fileName}`;
    }
  }

  return null;
}
