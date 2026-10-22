import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { connectMongo, closeMongo } from './db/mongo.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { adminRouter } from './routes/admin.js';
import { contactRouter } from './routes/contact.js';
import { productsRouter, statusRouter } from './routes/products.js';

/**
 * Robbiechaux Kicks API.
 * Runtime contract:
 *   GET /api/products        verified + published store inventory
 *   GET /api/products/:id    one public product (+ related)
 *   GET /api/status          honest capability report (no secrets)
 *   GET /api/contact/status  whether the form can actually deliver
 *   POST /api/contact        only 200 after the provider confirms delivery
 *   GET /api/admin/products  owner-only inventory view (ADMIN_TOKEN)
 */
export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token'],
    }),
  );
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ data: { ok: true, uptime: process.uptime() } });
  });

  app.use('/api/products', productsRouter);
  app.use('/api/status', statusRouter);
  app.use('/api/contact', contactRouter);
  app.use('/api/admin', adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

const isEntry = process.argv[1] && /index\.(ts|js)$/.test(process.argv[1]);

if (isEntry) {
  const app = createApp();

  // The API always serves: health/status must answer even if MongoDB is down.
  // Catalog routes then fail honestly with 503 database_unavailable.
  app.listen(config.port, () => {
    const keyState = config.provider.apiKey ? 'configured' : 'MISSING (setup pending)';
    console.log(`[api] Robbiechaux Kicks API listening on :${config.port}`);
    console.log(`[api] Provider key: ${keyState}`);
    console.log(`[api] CORS origins: ${config.corsOrigins.join(', ') || '(all)'}`);
  });

  connectMongo()
    .then(() => {
      console.log(`[api] MongoDB connected: ${config.mongo.uri}`);
    })
    .catch((err) => {
      console.error(
        '[api] MongoDB unavailable — catalog/admin endpoints will return 503 until it connects:',
        err instanceof Error ? err.message : err,
      );
    });

  const shutdown = async () => {
    await closeMongo();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export { closeMongo };
