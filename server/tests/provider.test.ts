import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Provider-client tests. These run WITHOUT a real KICKSDB_API_KEY: the cache
 * (MongoDB) and global fetch are both mocked, so these verify request shaping,
 * response-shape handling and error mapping — not live provider connectivity.
 */

const findOne = vi.fn();
const updateOne = vi.fn();

vi.mock('../src/db/mongo.js', () => ({
  providerCacheCollection: () => ({ findOne, updateOne }),
  productsCollection: () => ({ find: vi.fn(), findOne: vi.fn() }),
  allowlistCollection: () => ({ updateOne: vi.fn() }),
  contactMessagesCollection: () => ({ insertOne: vi.fn(), updateOne: vi.fn() }),
  getDb: () => {
    throw new Error('not connected');
  },
}));

process.env.KICKSDB_API_KEY = 'test-key-not-real';

const provider = await import('../src/provider/kicksdb.js');

beforeEach(() => {
  findOne.mockReset();
  updateOne.mockReset();
  findOne.mockResolvedValue(null);
  updateOne.mockResolvedValue({ acknowledged: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('assertSafeIdentifier', () => {
  it('accepts a normal SKU', () => {
    expect(provider.assertSafeIdentifier('DZ5485-100')).toBe('DZ5485-100');
  });

  it('accepts a lowercase slug', () => {
    expect(provider.assertSafeIdentifier('air-jordan-1-low')).toBe('air-jordan-1-low');
  });

  it('rejects an empty value', () => {
    expect(() => provider.assertSafeIdentifier('   ')).toThrowError(/Empty/);
  });

  it('rejects path traversal characters', () => {
    expect(() => provider.assertSafeIdentifier('../secrets')).toThrowError(/Invalid characters/);
  });

  it('rejects an over-long value', () => {
    expect(() => provider.assertSafeIdentifier('a'.repeat(200))).toThrowError(/too long/);
  });
});

describe('mapProviderRecord', () => {
  it('maps a complete provider record (name + image from the same record)', () => {
    const mapped = provider.mapProviderRecord({
      id: 'abc-123',
      title: 'Air Jordan 1 Low',
      brand: 'Jordan',
      sku: 'DZ5485-100',
      image: 'https://cdn.example/aj1.jpg',
      gallery: ['https://cdn.example/aj1.jpg', 'https://cdn.example/aj1-2.jpg'],
      link: 'https://stockx.com/air-jordan-1-low',
      min_price: 120,
      max_price: 200,
    });
    expect(mapped).not.toBeNull();
    expect(mapped?.providerProductId).toBe('abc-123');
    expect(mapped?.name).toBe('Air Jordan 1 Low');
    expect(mapped?.imageUrl).toBe('https://cdn.example/aj1.jpg');
    expect(mapped?.gallery).toEqual(['https://cdn.example/aj1.jpg', 'https://cdn.example/aj1-2.jpg']);
    expect(mapped?.sourceUrl).toBe('https://stockx.com/air-jordan-1-low');
  });

  it('maps provider variant sizes and their size systems', () => {
    const mapped = provider.mapProviderRecord({
      id: 'abc-123',
      title: 'Air Jordan 1 Low',
      image: 'https://cdn.example/aj1.jpg',
      variants: [{ id: 'variant-1', size: '4', size_type: 'us m' }],
    });
    expect(mapped?.variants).toEqual([{ id: 'variant-1', size: '4', sizeType: 'us m' }]);
  });

  it('drops a record missing an image rather than pairing a name with no image', () => {
    expect(provider.mapProviderRecord({ id: 'x', title: 'Nameless' })).toBeNull();
  });

  it('drops a record missing a title', () => {
    expect(provider.mapProviderRecord({ id: 'x', image: 'https://cdn.example/i.jpg' })).toBeNull();
  });

  it('falls back to a single-image gallery when gallery is absent', () => {
    const mapped = provider.mapProviderRecord({ id: 'x', title: 'T', image: 'https://cdn.example/i.jpg' });
    expect(mapped?.gallery).toEqual(['https://cdn.example/i.jpg']);
  });

  it('returns null for a non-object', () => {
    expect(provider.mapProviderRecord(null)).toBeNull();
    expect(provider.mapProviderRecord('nope')).toBeNull();
  });
});

describe('searchProviderProducts', () => {
  it('parses a search response whose data is an ARRAY', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 'a', title: 'Shoe A', image: 'https://cdn.example/a.jpg' },
            { id: 'b', title: 'Shoe B', image: 'https://cdn.example/b.jpg' },
          ],
        }),
      }),
    );
    const results = await provider.searchProviderProducts('shoe');
    expect(results.map((r) => r.providerProductId)).toEqual(['a', 'b']);
  });

  it('throws a malformed error when search data is not an array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { id: 'single' } }) }),
    );
    await expect(provider.searchProviderProducts('shoe')).rejects.toMatchObject({ kind: 'malformed' });
  });

  it('maps 401 to an auth error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));
    await expect(provider.searchProviderProducts('shoe')).rejects.toMatchObject({ kind: 'auth' });
  });

  it('maps 429 to a rate_limit error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }));
    await expect(provider.searchProviderProducts('shoe')).rejects.toMatchObject({ kind: 'rate_limit' });
  });

  it('maps 500 to an upstream error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    await expect(provider.searchProviderProducts('shoe')).rejects.toMatchObject({ kind: 'upstream' });
  });
});

describe('getProviderProduct', () => {
  it('parses a single-product response whose data is an OBJECT', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'a', title: 'Shoe A', image: 'https://cdn.example/a.jpg' } }),
      }),
    );
    const product = await provider.getProviderProduct('a');
    expect(product.providerProductId).toBe('a');
    expect(product.name).toBe('Shoe A');
  });

  it('requests variants when requested and parses them', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          id: 'a',
          title: 'Shoe A',
          image: 'https://cdn.example/a.jpg',
          variants: [{ id: 'v1', size: '4', size_type: 'us m' }],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const product = await provider.getProviderProduct('a', { includeVariants: true });
    expect(fetchMock.mock.calls[0]?.[0]).toContain('display%5Bvariants%5D=true');
    expect(product.variants).toEqual([{ id: 'v1', size: '4', sizeType: 'us m' }]);
  });

  it('throws malformed when data is an array for a single lookup', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [] }) }),
    );
    await expect(provider.getProviderProduct('a')).rejects.toMatchObject({ kind: 'malformed' });
  });

  it('maps 404 to a not_found error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
    await expect(provider.getProviderProduct('a')).rejects.toMatchObject({ kind: 'not_found', status: 404 });
  });
});

describe('providerStatus', () => {
  it('reports configured=true and never leaks the key value', () => {
    const status = provider.providerStatus();
    expect(status.configured).toBe(true);
    expect(JSON.stringify(status)).not.toContain('test-key-not-real');
  });
});
