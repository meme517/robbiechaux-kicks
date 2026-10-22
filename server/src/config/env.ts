import 'dotenv/config';

/**
 * =============================================================================
 * SERVER CONFIGURATION (owner / operator editable)
 * -----------------------------------------------------------------------------
 * All secrets and provider settings come from server-side environment
 * variables. Nothing here may ever be exposed to the browser:
 *  - no VITE_ prefix
 *  - no value returned by any /api route
 * =============================================================================
 */

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

const KICKSDB_DEFAULT_BASE_URL = 'https://api.kicks.dev/v3';

export const config = {
  nodeEnv: optional('NODE_ENV', 'development'),
  isProduction: optional('NODE_ENV', 'development') === 'production',
  port: Number(optional('PORT', '3000')),
  /** Comma-separated list of allowed browser origins. */
  corsOrigins: optional('CORS_ORIGINS', 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  mongo: {
    /** OWNER: database connection string (default is the local project DB). */
    uri: optional('MONGODB_URI', 'mongodb://localhost:27017/robbie_shoes'),
    dbName: optional('MONGODB_DB', 'robbie_shoes'),
  },

  /**
   * OWNER: sneaker-data provider (KicksDB, migrated to the pckt.sh data layer).
   * The API key must be a SERVER-SIDE secret. Never put it in a VITE_ variable.
   */
  provider: {
    name: 'kicksdb' as const,
    /** Configurable so provider base URL changes never require a code edit. */
    baseUrl: optional('PROVIDER_BASE_URL', KICKSDB_DEFAULT_BASE_URL).replace(/\/+$/, ''),
    baseUrlStockx: optional(
      'PROVIDER_STOCKX_BASE_URL',
      `${optional('PROVIDER_BASE_URL', KICKSDB_DEFAULT_BASE_URL).replace(/\/+$/, '')}/stockx`,
    ),
    apiKey: optional('KICKSDB_API_KEY'),
    /**
     * OWNER: set true ONLY after reading the provider's image-use terms.
     * When false, catalog images are still attributed per IMAGE_ATTRIBUTION.
     */
    imageUseApproved: optional('PROVIDER_IMAGE_USE_APPROVED', 'false') === 'true',
    /**
     * OWNER: attribution text rendered alongside provider-sourced imagery,
     * e.g. "Product data and images via KicksDB/StockX".
     */
    imageAttribution: optional('PROVIDER_IMAGE_ATTRIBUTION', 'Product imagery via KicksDB (StockX)'),
    defaultMarket: optional('PROVIDER_MARKET', 'US'),
    timeoutMs: Number(optional('PROVIDER_TIMEOUT_MS', '8000')),
    /** Metadata cache lifetime in seconds (provider data is cached 24h upstream). */
    cacheTtlSeconds: Number(optional('PROVIDER_CACHE_TTL_SECONDS', '86400')),
  },

  /**
   * Google Shopping results via SerpApi. The key is server-only and is never
   * returned from status endpoints or written to catalog records.
   */
  serpApi: {
    apiKey: optional('SERPAPI_API_KEY'),
    timeoutMs: Number(optional('SERPAPI_TIMEOUT_MS', '15000')),
  },

  /**
   * OWNER: catalog image/data source used while no KicksDB key is configured.
   * DummyJSON is a key-free test catalog with real product photography; every
   * record is fetched whole (name + image + price travel together).
   */
  catalog: {
    baseUrl: optional('CATALOG_API_BASE_URL', 'https://dummyjson.com').replace(/\/+$/, ''),
    timeoutMs: Number(optional('CATALOG_API_TIMEOUT_MS', '8000')),
    /** Attribution for imagery imported from the catalog source (not KicksDB). */
    imageAttribution: optional('CATALOG_IMAGE_ATTRIBUTION', 'Product imagery via DummyJSON (dummyjson.com)'),
    /**
     * OWNER: conversion used to derive an editable RWF figure from the source
     * catalog's USD price so a product can be published at all. Replace these
     * with your own selling prices as soon as you have them — they are a
     * starting point, not a quote.
     */
    usdToRwfRate: Number(optional('USD_TO_RWF_RATE', '1300')),
  },

  /**
   * OWNER: contact-form email provider. While null the API reports the form as
   * unavailable so the UI never shows a false "Message sent".
   */
  contact: {
    provider: optional('CONTACT_PROVIDER') || null,
    endpoint: optional('CONTACT_ENDPOINT') || null,
    apiKey: optional('CONTACT_API_KEY') || null,
    toEmail: optional('CONTACT_TO_EMAIL') || null,
  },

  /** OWNER: shared secret for the protected import/approval CLI + routes. */
  admin: {
    token: optional('ADMIN_TOKEN'),
  },
};

export type ServerConfig = typeof config;

/** True when a provider key exists — used to report honest capability status. */
export function hasProviderKey(): boolean {
  return Boolean(config.provider.apiKey && config.provider.apiKey.trim().length > 0);
}

export function hasContactProvider(): boolean {
  return Boolean(config.contact.provider && config.contact.endpoint);
}

export { required };
