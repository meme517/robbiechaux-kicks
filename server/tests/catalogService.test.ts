import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../src/models/product.js';

/**
 * Catalog-service tests. MongoDB is mocked so the public-catalog filtering
 * rules can be verified without a running database.
 */

const toArray = vi.fn();
const findOne = vi.fn();
const findResult = { sort: () => ({ toArray }), limit: () => ({ toArray }), toArray };

vi.mock('../src/db/mongo.js', () => ({
  productsCollection: () => ({ find: () => findResult, findOne }),
  allowlistCollection: () => ({ updateOne: vi.fn() }),
  providerCacheCollection: () => ({ findOne: vi.fn(), updateOne: vi.fn() }),
  contactMessagesCollection: () => ({ insertOne: vi.fn(), updateOne: vi.fn() }),
  getDb: () => {
    throw new Error('not connected');
  },
}));

const getProviderProduct = vi.fn();
vi.mock('../src/provider/kicksdb.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/provider/kicksdb.js')>();
  return { ...actual, getProviderProduct };
});

const { getPublicCatalog, getPublicProductById, approveCandidate } = await import(
  '../src/services/catalogService.js'
);

function mongoDoc(overrides: Partial<Product> = {}): Product {
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

beforeEach(() => {
  toArray.mockReset();
  findOne.mockReset();
  getProviderProduct.mockReset();
});

describe('getPublicCatalog', () => {
  it('returns only verified + published + publishable products', async () => {
    toArray.mockResolvedValue([
      mongoDoc({ id: 'kicksdb:ok' }),
      mongoDoc({ id: 'kicksdb:unpriced', priceRwf: null }),
      mongoDoc({ id: 'kicksdb:nopub', published: false }),
      mongoDoc({ id: 'kicksdb:novariants', variants: [] }),
    ]);
    // The DB query already filters to published+verified, but the service must
    // still re-check publish blockers on every returned document.
    const { products, meta } = await getPublicCatalog();
    expect(products.map((p) => p.id)).toEqual(['kicksdb:ok']);
    expect(meta.catalogStatus).toBe('live');
    expect(meta.count).toBe(1);
  });

  it('reports setup_pending with zero products', async () => {
    toArray.mockResolvedValue([]);
    const { products, meta } = await getPublicCatalog();
    expect(products).toEqual([]);
    expect(meta.catalogStatus).toBe('setup_pending');
    expect(meta.catalogMessage).toMatch(/setup pending/i);
  });

  it('drops documents that fail runtime validation', async () => {
    toArray.mockResolvedValue([{ id: 'broken', name: 'no category or gallery' }]);
    const { products } = await getPublicCatalog();
    expect(products).toEqual([]);
  });
});

describe('getPublicProductById', () => {
  it('returns a verified + publishable product', async () => {
    findOne.mockResolvedValue(mongoDoc({ id: 'kicksdb:ok' }));
    const product = await getPublicProductById('kicksdb:ok');
    expect(product?.id).toBe('kicksdb:ok');
  });

  it('returns null when the doc is unpriced (not publishable)', async () => {
    findOne.mockResolvedValue(mongoDoc({ priceRwf: null }));
    expect(await getPublicProductById('kicksdb:x')).toBeNull();
  });

  it('returns null when nothing matches', async () => {
    findOne.mockResolvedValue(null);
    expect(await getPublicProductById('missing')).toBeNull();
  });
});

describe('approveCandidate', () => {
  it('keeps an unpriced candidate OUT of the live catalog', async () => {
    getProviderProduct.mockResolvedValue({
      providerProductId: 'abc',
      name: 'Air Jordan 1 Low',
      imageUrl: 'https://cdn.example/aj1.jpg',
      gallery: ['https://cdn.example/aj1.jpg'],
    });
    const { product, blockers } = await approveCandidate({
      providerProductId: 'abc',
      priceRwf: null,
      category: 'sneakers',
      variants: [{ id: 'size-42', size: '42', stock: 1 }],
      dryRun: true,
    });
    expect(blockers).toContain('no owner-confirmed RWF price');
    expect(product.published).toBe(false);
    expect(product.verificationStatus).toBe('pending');
  });

  it('publishes a fully-configured candidate', async () => {
    getProviderProduct.mockResolvedValue({
      providerProductId: 'abc',
      name: 'Air Jordan 1 Low',
      imageUrl: 'https://cdn.example/aj1.jpg',
      gallery: ['https://cdn.example/aj1.jpg'],
    });
    const { product, blockers } = await approveCandidate({
      providerProductId: 'abc',
      priceRwf: 120000,
      category: 'sneakers',
      variants: [{ id: 'size-42', size: '42', stock: 3 }],
      dryRun: true,
    });
    expect(blockers).toEqual([]);
    expect(product.published).toBe(true);
    expect(product.verificationStatus).toBe('verified');
    // name + image travel together from the same provider record
    expect(product.name).toBe('Air Jordan 1 Low');
    expect(product.imageUrl).toBe('https://cdn.example/aj1.jpg');
  });
});
