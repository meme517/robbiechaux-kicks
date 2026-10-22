import { Router } from 'express';
import { config, hasProviderKey } from '../config/env.js';
import { providerStatus } from '../provider/kicksdb.js';
import { getRelatedProducts } from '../services/catalogService.js';
import { getPublicCatalog, getPublicProductById } from '../services/catalogService.js';
import { ApiError } from '../middleware/errors.js';

export const productsRouter = Router();

/**
 * GET /api/products
 * Public catalog: verified + published store inventory only, enriched with
 * verified provider metadata. The unrestricted provider catalog is never
 * exposed here.
 */
productsRouter.get('/', async (_req, res, next) => {
  try {
    const { products, meta } = await getPublicCatalog();
    res.json({ data: products, meta });
  } catch (err) {
    next(err);
  }
});

/** GET /api/products/:id — single public product, or 404. */
productsRouter.get('/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id || '').trim();
    // Tight validation: IDs are "provider:uuid" style. Reject junk early.
    if (!/^[A-Za-z0-9._:-]{1,160}$/.test(id)) {
      throw new ApiError('Invalid product id.', 400, 'invalid_id');
    }
    const product = await getPublicProductById(id);
    if (!product) throw new ApiError('Product not found.', 404, 'not_found');
    const related = await getRelatedProducts(product, 4);
    res.json({
      data: product,
      related,
      meta: {
        currency: config.provider.defaultMarket === 'US' ? 'RWF' : 'RWF',
        imageUseApproved: config.provider.imageUseApproved,
        imageAttribution: config.provider.imageAttribution,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/status — honest capability report. Safe to expose: contains no
 * secrets, only booleans and a human-readable message.
 */
export const statusRouter = Router();
statusRouter.get('/', (_req, res) => {
  res.json({
    data: {
      provider: providerStatus(),
      providerKeyConfigured: hasProviderKey(),
      /** Where published product images are imported from while no key exists. */
      catalogSource: hasProviderKey()
        ? { kind: 'provider', baseUrl: config.provider.baseUrl }
        : { kind: 'catalog_api', baseUrl: config.catalog.baseUrl, refresh: 'npm run import:api' },
      contactFormConfigured: Boolean(config.contact.provider && config.contact.endpoint),
      adminConfigured: Boolean(config.admin.token),
      environment: config.nodeEnv,
    },
  });
});
