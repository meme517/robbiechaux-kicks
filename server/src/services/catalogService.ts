import { config } from '../config/env.js';
import { storeConfig } from '../config/store.js';
import { allowlistCollection, productsCollection } from '../db/mongo.js';
import {
  isLivePublishable,
  livePublishBlockers,
  productSchema,
  type Product,
} from '../models/product.js';
import { getProviderProduct, ProviderError } from '../provider/kicksdb.js';

/**
 * =============================================================================
 * CATALOG / INVENTORY SERVICE
 * -----------------------------------------------------------------------------
 * The store's MongoDB catalog is the authority for public products and prices.
 * Provider-listed sizes may be shown with unknown local stock; those sizes
 * remain unavailable to cart ordering until the store confirms inventory.
 *
 * The PUBLIC catalog returns only products that are:
 *   - verificationStatus === 'verified'
 *   - published === true
 *   - backed by a configured RWF price and at least one size option
 * The unrestricted provider catalog is NEVER returned by the public API.
 * =============================================================================
 */

export interface PublicCatalogMeta {
  storeName: string;
  currency: string;
  deliveryArea: string;
  imageUseApproved: boolean;
  imageAttribution: string;
  /** Honest capability signal for the UI ("Catalog setup pending" vs live). */
  catalogStatus: 'live' | 'setup_pending';
  catalogMessage: string;
  count: number;
}

/** Validate a raw Mongo document through the runtime schema. Invalid docs are dropped. */
function toValidatedProduct(doc: unknown): Product | null {
  const parsed = productSchema.safeParse(doc);
  if (!parsed.success) {
    // Dropped, never "repaired" — repairing could mis-pair a name with an image.
    return null;
  }
  return parsed.data;
}

/**
 * Public catalog. Only verified + published + fully-configured products.
 * `demo` records live in the client only; they never appear here.
 */
export async function getPublicCatalog(): Promise<{ products: Product[]; meta: PublicCatalogMeta }> {
  const docs = await productsCollection()
    .find({ published: true, verificationStatus: 'verified' })
    .sort({ arrivedAt: -1, name: 1 })
    .toArray();

  const products = docs
    .map(toValidatedProduct)
    .filter((p): p is Product => p !== null)
    // Belt-and-braces: re-check live-publish blockers even for verified docs.
    .filter((p) => isLivePublishable(p));

  return { products, meta: buildMeta(products.length) };
}

export async function getPublicProductById(id: string): Promise<Product | null> {
  const doc = await productsCollection().findOne({
    id,
    published: true,
    verificationStatus: 'verified',
  });
  if (!doc) return null;
  const product = toValidatedProduct(doc);
  if (!product || !isLivePublishable(product)) return null;
  return product;
}

/** Related products from VERIFIED store inventory only. */
export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  const docs = await productsCollection()
    .find({
      published: true,
      verificationStatus: 'verified',
      id: { $ne: product.id },
    })
    .limit(60)
    .toArray();
  const valid = docs.map(toValidatedProduct).filter((p): p is Product => p !== null);
  const sameCategory = valid.filter((p) => p.category === product.category);
  const rest = valid.filter((p) => p.category !== product.category);
  return [...sameCategory, ...rest].slice(0, limit);
}

/**
 * Admin-only listing: includes pending/unpublished products and the blockers
 * that keep each one out of the live catalog.
 */
export async function getAdminProducts() {
  const docs = await productsCollection().find({}).sort({ _id: -1 }).toArray();
  return docs.map((doc) => {
    const product = toValidatedProduct(doc);
    return {
      id: (doc as { id?: string }).id,
      raw: doc,
      valid: product !== null,
      blockers: product ? livePublishBlockers(product) : ['record failed runtime validation'],
      inLiveCatalog: product ? isLivePublishable(product) : false,
    };
  });
}

/**
 * Approve a provider candidate into the store inventory (the ONLY path that
 * can create a publishable product). The provider record provides name +
 * image FROM THE SAME RECORD; the owner supplies price, category and variants.
 */
export async function approveCandidate(params: {
  providerProductId: string;
  priceRwf: number | null;
  category: Product['category'];
  variants: { id: string; size: string; stock: number | null }[];
  colorway?: string;
  sizeSystem?: string;
  featured?: boolean;
  arrivedAt?: string;
  /** Dry run returns the record without writing. */
  dryRun?: boolean;
}): Promise<{ product: Product; blockers: string[] }> {
  const providerProductId = params.providerProductId.trim();
  const providerProduct = await getProviderProduct(providerProductId);

  const id = `kicksdb:${providerProduct.providerProductId}`;
  const record: Product = {
    id,
    provider: 'kicksdb',
    providerProductId: providerProduct.providerProductId,
    sku: providerProduct.sku,
    // Name and images come from the SAME provider record — never joined.
    name: providerProduct.name,
    brand: providerProduct.brand,
    colorway: params.colorway ?? providerProduct.colorway,
    category: params.category,
    imageUrl: providerProduct.imageUrl,
    gallery: providerProduct.gallery.length > 0 ? providerProduct.gallery : [providerProduct.imageUrl],
    sourceUrl: providerProduct.sourceUrl,
    priceRwf: params.priceRwf,
    sizeSystem: params.sizeSystem,
    variants: params.variants,
    // Imported as verified because the owner explicitly approved this exact ID,
    // but it stays unpublished until it passes the live-publish checks.
    verificationStatus: 'verified',
    published: true,
    featured: params.featured,
    arrivedAt: params.arrivedAt,
    imageIsCatalogArt: true,
    imageAttribution: config.provider.imageAttribution,
  };

  const parsed = productSchema.safeParse(record);
  if (!parsed.success) {
    throw new ProviderError(
      `Approved record failed validation: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
      'malformed',
      400,
    );
  }

  const blockers = livePublishBlockers(parsed.data);
  const willPublish = blockers.length === 0;
  const finalRecord: Product = { ...parsed.data, published: willPublish, verificationStatus: willPublish ? 'verified' : 'pending' };

  if (!params.dryRun) {
    await productsCollection().updateOne({ id }, { $set: finalRecord }, { upsert: true });
    await allowlistCollection().updateOne(
      { provider: 'kicksdb', providerProductId: providerProduct.providerProductId },
      {
        $set: {
          provider: 'kicksdb',
          providerProductId: providerProduct.providerProductId,
          sku: providerProduct.sku,
          priceRwf: params.priceRwf,
          category: params.category,
          colorway: params.colorway,
          sizeSystem: params.sizeSystem,
          variants: params.variants,
          featured: params.featured,
          arrivedAt: params.arrivedAt,
          createdAt: new Date().toISOString(),
        },
      },
      { upsert: true },
    );
  }

  return { product: finalRecord, blockers };
}

/** Owner-managed (non-sneaker) products: owner-supplied name + photo, same record. */
export async function upsertOwnerProduct(input: {
  id: string;
  name: string;
  category: Product['category'];
  imageUrl: string;
  gallery?: string[];
  brand?: string;
  colorway?: string;
  priceRwf: number | null;
  variants: { id: string; size: string; stock: number | null }[];
  featured?: boolean;
  arrivedAt?: string;
  published?: boolean;
}): Promise<{ product: Product | null; blockers: string[] }> {
  const record: Product = {
    id: input.id,
    provider: 'store',
    name: input.name,
    brand: input.brand,
    colorway: input.colorway,
    category: input.category,
    imageUrl: input.imageUrl,
    gallery: input.gallery && input.gallery.length > 0 ? input.gallery : [input.imageUrl],
    priceRwf: input.priceRwf,
    variants: input.variants,
    verificationStatus: 'verified',
    published: true,
    featured: input.featured,
    arrivedAt: input.arrivedAt,
    imageIsCatalogArt: false,
  };
  const parsed = productSchema.safeParse(record);
  if (!parsed.success) {
    return { product: null, blockers: parsed.error.issues.map((i) => i.path.join('.')) };
  }
  const blockers = livePublishBlockers(parsed.data);
  const willPublish = blockers.length === 0 && input.published !== false;
  const finalRecord: Product = {
    ...parsed.data,
    published: willPublish,
    verificationStatus: willPublish ? 'verified' : 'pending',
  };
  await productsCollection().updateOne({ id: input.id }, { $set: finalRecord }, { upsert: true });
  return { product: finalRecord, blockers };
}

function buildMeta(count: number): PublicCatalogMeta {
  const live = count > 0;
  return {
    storeName: storeConfig.storeName,
    currency: storeConfig.currency,
    deliveryArea: storeConfig.deliveryArea,
    imageUseApproved: config.provider.imageUseApproved,
    imageAttribution: config.provider.imageAttribution,
    catalogStatus: live ? 'live' : 'setup_pending',
    catalogMessage: live
      ? 'Published store inventory.'
      : 'Catalog setup pending — no verified products are published yet. Contact the store to hear what is currently in stock.',
    count,
  };
}
