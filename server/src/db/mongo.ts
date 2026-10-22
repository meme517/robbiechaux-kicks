import { MongoClient, type Db, type Collection } from 'mongodb';
import { config } from '../config/env.js';
import { ApiError } from '../middleware/errors.js';
import type { AllowlistEntry, Product } from '../models/product.js';

/**
 * MongoDB connection. Default database: mongodb://localhost:27017/robbie_shoes
 * (see server/src/config/env.ts — MONGODB_URI / MONGODB_DB).
 */

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(config.mongo.uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
  await client.connect();
  db = client.db(config.mongo.dbName);
  await ensureIndexes(db);
  return db;
}

export function getDb(): Db {
  if (!db) {
    throw new ApiError(
      'The store database is not available yet. Please try again shortly.',
      503,
      'database_unavailable',
    );
  }
  return db;
}

/** True once a MongoDB connection is established (used by health/status). */
export function isMongoConnected(): boolean {
  return db !== null;
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

export function productsCollection(): Collection<Product> {
  return getDb().collection<Product>('products');
}

/** Owner-approved allowlist of provider products the store actually sells. */
export function allowlistCollection(): Collection<AllowlistEntry & { createdAt: string }> {
  return getDb().collection<AllowlistEntry & { createdAt: string }>('allowlist');
}

/** Cached provider metadata so outages never wipe the catalog. */
export interface ProviderCacheDoc {
  key: string;
  payload: unknown;
  fetchedAt: string;
  expiresAt: string;
}
export function providerCacheCollection(): Collection<ProviderCacheDoc> {
  return getDb().collection<ProviderCacheDoc>('provider_cache');
}

export function contactMessagesCollection() {
  return getDb().collection('contact_messages');
}

async function ensureIndexes(database: Db): Promise<void> {
  await database.collection('products').createIndex({ id: 1 }, { unique: true });
  await database.collection('products').createIndex({ sku: 1 });
  await database.collection('products').createIndex({ published: 1, verificationStatus: 1 });
  await database
    .collection('allowlist')
    .createIndex({ provider: 1, providerProductId: 1, sku: 1 }, { unique: true });
  await database
    .collection('provider_cache')
    .createIndex({ key: 1 }, { unique: true });
  await database.collection('provider_cache').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await database.collection('contact_messages').createIndex({ createdAt: -1 });
}
