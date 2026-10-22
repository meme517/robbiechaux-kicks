import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { config } from '../src/config/env.js';

/**
 * API route tests. The catalog service and provider are mocked so routes can be
 * exercised without MongoDB or a provider key. Uses a real HTTP listener.
 */

const getPublicCatalog = vi.fn();
const getPublicProductById = vi.fn();
const getRelatedProducts = vi.fn();

vi.mock('../src/services/catalogService.js', () => ({
  getPublicCatalog,
  getPublicProductById,
  getRelatedProducts,
  getAdminProducts: vi.fn().mockResolvedValue([]),
  approveCandidate: vi.fn(),
  upsertOwnerProduct: vi.fn(),
}));

vi.mock('../src/db/mongo.js', () => ({
  connectMongo: vi.fn(),
  closeMongo: vi.fn(),
  productsCollection: () => ({ find: vi.fn(), findOne: vi.fn() }),
  allowlistCollection: () => ({ updateOne: vi.fn() }),
  providerCacheCollection: () => ({ findOne: vi.fn(), updateOne: vi.fn() }),
  contactMessagesCollection: () => ({ insertOne: vi.fn(), updateOne: vi.fn() }),
  getDb: () => {
    throw new Error('not connected');
  },
}));

delete process.env.KICKSDB_API_KEY;
delete process.env.ADMIN_TOKEN;

const { createApp } = await import('../src/index.js');

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('GET /api/health', () => {
  it('reports ok', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.ok).toBe(true);
  });
});

describe('GET /api/status', () => {
  it('reports honest capability flags without secrets', async () => {
    // Deleting the var cannot work: `import "dotenv/config"` repopulates it
    // from server/.env when the config module loads. The flags must therefore
    // be checked against the server's real configuration instead.
    const res = await fetch(`${baseUrl}/api/status`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.providerKeyConfigured).toBe(Boolean(config.provider.apiKey));
    expect(body.data.contactFormConfigured).toBe(
      Boolean(config.contact.provider && config.contact.endpoint),
    );
    const raw = JSON.stringify(body);
    expect(raw).not.toContain('KICKSDB_API_KEY');
    if (config.provider.apiKey) expect(raw).not.toContain(config.provider.apiKey);
  });
});

describe('GET /api/products', () => {
  it('returns the public catalog envelope', async () => {
    getPublicCatalog.mockResolvedValue({
      products: [{ id: 'kicksdb:ok', name: 'Shoe' }],
      meta: { count: 1, catalogStatus: 'live' },
    });
    const res = await fetch(`${baseUrl}/api/products`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.meta.catalogStatus).toBe('live');
  });
});

describe('GET /api/products/:id', () => {
  it('rejects an invalid id with 400', async () => {
    const res = await fetch(`${baseUrl}/api/products/${encodeURIComponent('bad id!')}`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('invalid_id');
  });

  it('returns 404 for a missing product', async () => {
    getPublicProductById.mockResolvedValue(null);
    const res = await fetch(`${baseUrl}/api/products/kicksdb:missing`);
    expect(res.status).toBe(404);
  });

  it('returns the product and related list when found', async () => {
    getPublicProductById.mockResolvedValue({ id: 'kicksdb:ok', name: 'Shoe', category: 'sneakers' });
    getRelatedProducts.mockResolvedValue([]);
    const res = await fetch(`${baseUrl}/api/products/kicksdb:ok`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.id).toBe('kicksdb:ok');
    expect(Array.isArray(body.related)).toBe(true);
  });
});

describe('GET /api/contact/status', () => {
  it('reports the form as unavailable when no provider is configured', async () => {
    const res = await fetch(`${baseUrl}/api/contact/status`);
    const body = await res.json();
    expect(body.data.available).toBe(false);
    expect(body.data.message).toMatch(/unavailable/i);
  });
});

describe('POST /api/contact', () => {
  it('returns 503 and never claims delivery without a provider', async () => {
    const res = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'A', email: 'a@b.com', subject: 'Hi', message: 'Hello there!' }),
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe('contact_unavailable');
    expect(JSON.stringify(body)).not.toContain('Message sent');
  });
});

describe('GET /api/admin/products', () => {
  it('returns 503 when admin access is not configured', async () => {
    const res = await fetch(`${baseUrl}/api/admin/products`);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe('admin_disabled');
  });
});

describe('unknown route', () => {
  it('returns a structured 404', async () => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('not_found');
  });
});
