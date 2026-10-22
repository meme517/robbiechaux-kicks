import { Router } from 'express';
import { z } from 'zod';
import { getAdminProducts } from '../services/catalogService.js';
import { requireAdmin } from '../middleware/errors.js';

/**
 * Owner-only read view of the inventory, including products that are NOT in
 * the live catalog, with the exact blockers for each. Protected by ADMIN_TOKEN.
 * There is deliberately no public admin UI — the CLI scripts are the workflow.
 */
export const adminRouter = Router();

adminRouter.get('/products', requireAdmin, async (_req, res, next) => {
  try {
    const products = await getAdminProducts();
    res.json({ data: products });
  } catch (err) {
    next(err);
  }
});

/** POST /api/admin/verify-provider — authenticated provider check (owner only). */
adminRouter.post('/verify-provider', requireAdmin, async (req, res, next) => {
  try {
    const body = z.object({ query: z.string().min(1).max(120).optional() }).safeParse(req.body ?? {});
    const query = body.success ? body.data.query : undefined;
    const { verifyProviderAuth } = await import('../provider/kicksdb.js');
    const result = await verifyProviderAuth(query);
    res.status(result.ok ? 200 : 502).json({ data: result });
  } catch (err) {
    next(err);
  }
});
