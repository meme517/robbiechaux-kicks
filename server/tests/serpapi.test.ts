import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const findOne = vi.fn();
const updateOne = vi.fn();

vi.mock('../src/db/mongo.js', () => ({
  providerCacheCollection: () => ({ findOne, updateOne }),
}));

process.env.SERPAPI_API_KEY = 'test-key-not-real';

const provider = await import('../src/provider/serpapi.js');

beforeEach(() => {
  findOne.mockReset();
  updateOne.mockReset();
  findOne.mockResolvedValue(null);
  updateOne.mockResolvedValue({ acknowledged: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('searchGoogleShoppingProducts', () => {
  it('maps shopping offers and only keeps explicitly listed sizes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          shopping_results: [
            {
              title: 'Nike Air Jordan 1 Low - US 9',
              extracted_price: 110,
              source: 'Example Shop',
              link: 'https://shop.example/item',
              product_id: 'offer-1',
              thumbnail: 'https://images.example/shoe.jpg',
            },
          ],
        }),
      }),
    );

    const products = await provider.searchGoogleShoppingProducts('Nike Air Jordan 1 Low');

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      name: 'Nike Air Jordan 1 Low - US 9',
      providerAvgPriceUsd: 110,
      imageUrl: 'unavailable',
      gallery: ['unavailable'],
      sourceUrl: 'https://shop.example/item',
    });
    expect(products[0].variants?.map((variant) => variant.size)).toEqual(['US 9']);
    expect(updateOne).toHaveBeenCalledOnce();
  });

  it('reuses valid cached search results without making another request', async () => {
    const cached = [{ providerProductId: 'cached', name: 'Cached shoe' }];
    findOne.mockResolvedValue({
      key: expect.any(String),
      payload: cached,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    await expect(provider.searchGoogleShoppingProducts('Nike Air Max')).resolves.toEqual(cached);

    expect(fetch).not.toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();
  });

  it('reports SerpApi authentication failures without exposing the key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );

    await expect(provider.searchGoogleShoppingProducts('Nike Dunk Low')).rejects.toMatchObject({
      name: 'ProviderError',
      kind: 'auth',
      message: 'SerpApi authentication failed. Check SERPAPI_API_KEY and account status.',
    });
  });

  it('reports exhausted monthly allowance as a rate limit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 429 }),
    );

    await expect(provider.searchGoogleShoppingProducts('Nike Dunk Low')).rejects.toMatchObject({
      name: 'ProviderError',
      kind: 'rate_limit',
      status: 429,
    });
  });
});
