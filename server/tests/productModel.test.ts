import { describe, expect, it } from 'vitest';
import {
  isLivePublishable,
  livePublishBlockers,
  productSchema,
  type Product,
} from '../src/models/product.js';

function baseProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'kicksdb:abc',
    provider: 'kicksdb',
    providerProductId: 'abc',
    name: 'Verified Runner',
    category: 'sneakers',
    imageUrl: 'https://cdn.example/runner.jpg',
    gallery: ['https://cdn.example/runner.jpg'],
    priceRwf: 45000,
    variants: [{ id: 'size-42', size: '42', stock: 2 }],
    verificationStatus: 'verified',
    published: true,
    ...overrides,
  };
}

describe('productSchema', () => {
  it('accepts a fully-formed public product', () => {
    expect(productSchema.safeParse(baseProduct()).success).toBe(true);
  });

  it('rejects a product with no gallery', () => {
    const bad = { ...baseProduct(), gallery: [] };
    expect(productSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a negative stock count', () => {
    const bad = baseProduct({ variants: [{ id: 's', size: '42', stock: -1 }] });
    expect(productSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts a null price (unpriced, not publishable)', () => {
    expect(productSchema.safeParse(baseProduct({ priceRwf: null })).success).toBe(true);
  });

  it('rejects an unknown category', () => {
    const bad = { ...baseProduct(), category: 'cleats' };
    expect(productSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a non-integer price', () => {
    const bad = baseProduct({ priceRwf: 45000.5 });
    expect(productSchema.safeParse(bad).success).toBe(false);
  });

  it('normalizes BSON null optional strings to undefined (MongoDB round-trip)', () => {
    // MongoDB stores a field written from `undefined` as null; a document read
    // back must still validate rather than being silently dropped.
    const fromMongo = { ...baseProduct(), brand: null, colorway: null, sku: null };
    const parsed = productSchema.safeParse(fromMongo);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.brand).toBeUndefined();
      expect(parsed.data.colorway).toBeUndefined();
      expect(parsed.data.sku).toBeUndefined();
    }
  });

  it('normalizes null optional booleans, dates and source URLs', () => {
    const fromMongo = {
      ...baseProduct(),
      featured: null,
      arrivedAt: null,
      imageIsCatalogArt: null,
      sourceUrl: null,
    };
    const parsed = productSchema.safeParse(fromMongo);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.featured).toBeUndefined();
      expect(parsed.data.arrivedAt).toBeUndefined();
    }
  });
});

describe('livePublishBlockers', () => {
  it('reports no blockers for a verified, priced, published product', () => {
    expect(livePublishBlockers(baseProduct())).toEqual([]);
    expect(isLivePublishable(baseProduct())).toBe(true);
  });

  it('blocks an unverified product', () => {
    const blockers = livePublishBlockers(baseProduct({ verificationStatus: 'pending' }));
    expect(blockers).toContain('verificationStatus is not "verified"');
    expect(isLivePublishable(baseProduct({ verificationStatus: 'pending' }))).toBe(false);
  });

  it('blocks an unpublished product', () => {
    expect(livePublishBlockers(baseProduct({ published: false }))).toContain('published is false');
  });

  it('blocks a product with no confirmed RWF price', () => {
    expect(livePublishBlockers(baseProduct({ priceRwf: null }))).toContain('no owner-confirmed RWF price');
  });

  it('blocks a product with no size variants', () => {
    expect(livePublishBlockers(baseProduct({ variants: [] }))).toContain('no owner-confirmed size variants');
  });

  it('blocks a product missing a name or image', () => {
    const noName = { ...baseProduct(), name: '   ' } as Product;
    const noImage = { ...baseProduct(), imageUrl: '' } as Product;
    expect(livePublishBlockers(noName)).toContain('missing verified name');
    expect(livePublishBlockers(noImage)).toContain('missing verified image');
  });
});
