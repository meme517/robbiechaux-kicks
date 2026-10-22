# Robbiechaux Kicks

Full-stack storefront for **Robbiechaux Kicks** — *Step in. Stand out.*
Sneakers, loafers, formal shoes, slides and clogs · Downtown, Room L3-51, Kigali, Rwanda.

Phase 2 adds a real backend: a Node/Express + MongoDB API, server-side integration with the
**KicksDB** sneaker-data provider, a TypeScript React frontend, and a protected product-approval
workflow. Business details, routes, design and the "honest state" behaviour from Phase 1 are
preserved exactly — nothing about the store, its prices, its email or its policies is invented.

```
robbie_shorestore/
  client/   React 19 + TypeScript + Vite storefront (only ever talks to our own API)
  server/   Express + MongoDB API; owns inventory, prices and provider metadata
```

---

## Quick start

```bash
npm install

# 1. Configure the server (secrets never live in the client)
copy server\.env.example server\.env      # PowerShell:  Copy-Item
#    …or on macOS/Linux:  cp server/.env.example server/.env
#    Leave KICKSDB_API_KEY blank to run in an honest "setup pending" state.

# 2. Run both apps (API :3000, web :5173 with /api proxied to the API)
npm run dev
```

Open http://localhost:5173. To preview the frontend **without** a backend or an API key, set
`VITE_CATALOG_MODE=demo` in `client/.env` — the site then renders clearly-labelled demo records
instead of fabricating inventory.

Useful root scripts:

| Command | What it does |
| --- | --- |
| `npm run dev` | Run API + web together |
| `npm run build` | Build server (`server/dist`) and client (`client/dist`) |
| `npm test` | Server tests (vitest) + client smoke checks |
| `npm run lint` | ESLint for both workspaces |
| `npm run typecheck` | `tsc --noEmit` for both workspaces |
| `npm run seed:demo` | Seed clearly-labelled demo inventory (needs MongoDB) |
| `npm run import:search -- --query "<SKU or name>"` | Search provider candidates (read-only, needs key) |
| `npm run import:approve -- …` | Approve one exact candidate into inventory (needs key + MongoDB) |

Server workspace also exposes: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`.
Client workspace: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `generate:demo-images`.

---

## Honest status — what is (and is not) real

| Area | Status |
| --- | --- |
| Business details (name, taglines, location, both phones, Instagram, delivery area, developer credit) | Carried over from Phase 1 **exactly as given** |
| Store email | **Not available.** `[STORE_EMAIL]` is shown as an explicit placeholder; no `mailto:` link exists until a real address is entered |
| Product identities, prices, stock | **Owner-gated.** Nothing is public until a product is verified, priced and has variants. A provider search hit is a *candidate*, never approval |
| KicksDB provider calls | **Unverified in this environment.** No `KICKSDB_API_KEY` was available, so no live provider request has been executed here; the client is tested against mocked responses |
| MongoDB | **Not exercised here** (no local `mongod` was available). Tests mock the database; run `npm run seed:demo` against a running instance to verify end-to-end |
| Promotions | **Disabled.** The historical 20% back-to-school discount shows nothing unless enabled with real dates and applicable products |
| Delivery charges / timing / payment / returns | **Not invented.** Rendered as "confirmed by the store" |
| Contact form delivery | **Unavailable until a provider is configured.** The form is honestly replaced by phone/WhatsApp options, and "Message sent" can only appear after the backend confirms delivery |
| Brand partnerships / authenticity | **Never claimed.** Brand names in demo records are placeholders only |
| Review ratings, follower counts, sales stats, awards | **Not shown anywhere** |

Whenever the client runs on demo records (`VITE_CATALOG_MODE=demo`) every page carries a
persistent demo banner, and demo WhatsApp orders are prefixed
`[DEMO PREVIEW — this is NOT a real order.]`.

---

## Architecture

### Request path

```
browser ──/api──▶ Express API ──▶ MongoDB (store inventory: prices, sizes, stock)
                        │
                        └──▶ KicksDB (product metadata: name, image) ── key is server-side only
```

The browser **never** talks to the provider and **never** sees a provider key. The only `VITE_`
variables are `VITE_API_BASE_URL` and `VITE_CATALOG_MODE`; the API key is read solely from the
server environment.

### Server (`server/src`)

| File | Responsibility |
| --- | --- |
| `config/env.ts` | All server config + secrets; `hasProviderKey()`, `hasContactProvider()` |
| `config/store.ts` | Confirmed business details used in API responses |
| `models/product.ts` | Zod schemas (`productSchema`, `variantSchema`, `allowlistEntrySchema`) and `livePublishBlockers` / `isLivePublishable` |
| `db/mongo.ts` | MongoDB connection, collections, indexes (default `mongodb://localhost:27017/robbie_shoes`) |
| `provider/kicksdb.ts` | Provider client: search/lookup, response-shape parsing, identifier validation, timeouts, 401/403/429/404/5xx handling, Mongo-backed cache |
| `services/catalogService.ts` | Public catalog reads + `approveCandidate` / `upsertOwnerProduct` write paths |
| `middleware/errors.ts` | `ApiError`, `notFoundHandler`, `errorHandler`, `requireAdmin` |
| `routes/products.ts` | `GET /api/products`, `GET /api/products/:id`, `GET /api/status` |
| `routes/contact.ts` | `GET /api/contact/status`, `POST /api/contact` |
| `routes/admin.ts` | `GET /api/admin/products`, `POST /api/admin/verify-provider` (ADMIN_TOKEN) |
| `scripts/` | `importSearch.ts`, `approveCandidate.ts`, `seedDemoInventory.ts` |

### API surface

| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness |
| `GET` | `/api/products` | **Verified + published + priced** inventory only. The unrestricted provider catalog is never exposed |
| `GET` | `/api/products/:id` | One public product + related; `400` on junk id, `404` when missing |
| `GET` | `/api/status` | Honest capability report (booleans, no secrets) |
| `GET` | `/api/contact/status` | Whether the form can actually send |
| `POST` | `/api/contact` | Only `200` after the configured provider confirms delivery |
| `GET` | `/api/admin/products` | Owner-only view incl. unpublished products + blockers |
| `POST` | `/api/admin/verify-provider` | Authenticated provider check |

### Client (`client/src`)

```
config/storeConfig.ts      ← ALL owner-editable business settings (single source of truth)
data/demoCatalog.ts        ← demo records ONLY (clearly labelled; never mixed with live data)
services/catalogService.ts ← api | demo access, runtime guards, filtering, sorting
services/contactService.ts ← contact status + submit (withdraws honestly when unconfigured)
context/CartContext.tsx    ← cart state, localStorage (`robbiechaux-cart-v2`), revalidation view
utils/currency.ts          ← Intl RWF formatting (values are numeric everywhere else)
utils/whatsapp.ts          ← wa.me links + URL-encoded order messages
utils/cart.ts              ← persistence + price/availability revalidation
components/                ← Layout, Header, Footer, Logo, ProductCard/Grid/Filters, Price,
                             ProductImage, SizePicker, CategoryIcon, StockBadge, ContactForm,
                             Loading/Error/EmptyState, PageMeta, DemoBanner, WhatsAppFab, …
pages/                     ← Home, Shop, ProductDetail, About, Contact, Cart, Faq, NotFound
```

Routes: `/`, `/shop`, `/product/:id`, `/about`, `/contact`, `/cart`, `/faq`, `*` (404).

---

## Product rules (enforced, not aspirational)

1. **Name and image come from the same validated record.** They are never joined by array
   position, search rank or fuzzy brand match. A record missing an id, title or image is dropped
   entirely rather than paired with an unrelated image.
2. **A search result is a candidate, not inventory.** The wishlist import uses the store-approved
   KicksDB price conversion and lists provider sizes; local stock remains unknown until confirmed.
3. **Unverified or unpriced products stay unpublished.** `livePublishBlockers()` lists exactly
   why a record is not live; unknown-stock sizes are visible but cannot be added to the cart.
4. **No unrelated-shoe substitution.** A broken/missing image renders a neutral
   **"Image unavailable"** panel.
5. **Provider imagery is labelled.** Provider-sourced metadata/art is flagged
   (`imageIsCatalogArt`) and attributed with `PROVIDER_IMAGE_ATTRIBUTION`; catalog art is never
   described as a photo of physical store stock.
6. **RWF prices follow the store's configured policy.** Wishlist prices are converted from KicksDB
   USD prices using `USD_TO_RWF_RATE`; demo prices remain placeholders.
7. **Demo records are separable.** Demo ids are prefixed `demo:` and demo orders are marked.

---

## Owner configuration guide

### 1. Server environment

Copy `server/.env.example` → `server/.env` and set:

```ini
MONGODB_URI=mongodb://localhost:27017/robbie_shoes
KICKSDB_API_KEY=            # from https://kicks.dev/api-keys ; blank = honest "setup pending"
PROVIDER_IMAGE_USE_APPROVED=false
PROVIDER_IMAGE_ATTRIBUTION=Product imagery via KicksDB (StockX)
CONTACT_PROVIDER=           # blank = contact form honestly unavailable
CONTACT_ENDPOINT=
ADMIN_TOKEN=                # long random value; protects /api/admin/*
```

Generate an admin token with
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

### 2. Client environment

Copy `client/.env.example` → `client/.env`. Never put secrets here — `VITE_*` values ship to the
browser.

```ini
VITE_API_BASE_URL=http://localhost:3000
VITE_CATALOG_MODE=api       # 'api' (default) or 'demo' (labelled design preview)
```

### 3. Logo

Drop the official logo at `client/public/images/logo.png` (served at `/images/logo.png`).
Until it exists, the `Logo` component renders a designed **RK** monogram — a missing logo never
shows a broken-image icon, and no substitute "official logo" is invented.

### 4. Store email

In `client/src/config/storeConfig.ts`:

```ts
email: '[STORE_EMAIL]',   // ← replace with the real address
```

Once a valid address replaces the placeholder, the footer and Contact page turn it into a working
`mailto:` link automatically.

### 5. Importing the KicksDB wishlist

The wishlist importer matches the requested KicksDB models, converts provider
USD prices to RWF using `USD_TO_RWF_RATE` (default `1300`), and imports provider
size options. Review matches with a dry run first:

```bash
npm run import:wishlist -- --dry-run
npm run import:wishlist
```

KicksDB does not report the store's local stock. Imported size options are
labelled as unconfirmed, cannot be added to the cart, and must be confirmed by
the store over WhatsApp. Provider prices are converted with the configured
`USD_TO_RWF_RATE` (the approved default is `1300`). Set the rotated `KICKSDB_API_KEY` and Atlas
`MONGODB_URI` in `server/.env` for the local import command; keep that file
private and gitignored.

```bash
# 1. Search provider candidates (read-only). Verify an EXACT match yourself.
npm run import:search -- --query "DZ5485-100"

# 2. Approve exactly one candidate. Prices are the OWNER's RWF selling prices.
npm run import:approve -- --providerProductId "<id>" --price 45000 --category sneakers \
  --sizes "40:2,41:3,42:1" [--colorway "White / Gold"] [--sizeSystem "EU"] [--featured] [--dry-run]
```

`--dry-run` prints the resulting record and its blockers without writing. Owner-supplied
(non-sneaker) products use `upsertOwnerProduct` with the owner's own name and photo.

### 6. Promotions & policies

`storeConfig.promotions.backToSchool20.enabled` stays `false` and the historical discount stays
invisible until enabled **with dates and applicable products**. Delivery charges, timing, payment
methods and returns live in `storeConfig.policies` and remain "confirmed by the store" until set.

---

## Deployment

- **Render + MongoDB Atlas (configured by `render.yaml`)** — create an Atlas M0
  cluster and a database user, then add the Render API service's outbound IP
  addresses to the Atlas Network Access IP access list. In Render, create a
  Blueprint from this repository and provide the Atlas connection string for
  `MONGODB_URI` when prompted. Keep that URI in Render's environment settings;
  never commit it or put it in a `VITE_` variable. The Blueprint builds the API
  and frontend as separate services, configures their API URL and CORS origin,
  and rewrites frontend deep links to `index.html`.
- The included Render services use the free plan. Free API instances can spin
  down when idle, so the first request after inactivity may be slow.
- **Backend** — run `npm --workspace server run build`, then `node dist/index.js` (or
  `npm --workspace server start`) behind your process manager. Provide the server env vars above.
  Default port `3000` (`PORT`).
- **Frontend** — `npm --workspace client run build` → static output in `client/dist`. Set
  `VITE_API_BASE_URL` to the deployed API origin.
- **Deep-link fallback is mandatory** — unknown paths must serve `index.html`:
  - Netlify: `client/public/_redirects` (`/*  /index.html  200`) — included.
  - nginx: `location / { try_files $uri $uri/ /index.html; }`
- **MongoDB** — point `MONGODB_URI` at your database; indexes are created automatically on
  connect. **Never seed demo data into production**, and delete records whose id starts with
  `demo:` before going live.

---

## Verification

Run everything:

```bash
npm run typecheck   # both workspaces
npm run lint        # both workspaces
npm test            # server (vitest) + client smoke
npm run build       # both workspaces
```

### What the tests cover

**Server (vitest, `server/tests/`) — 49 tests, all passing here:**

| Suite | Coverage |
| --- | --- |
| `productModel.test.ts` | Zod schema acceptance/rejection; every `livePublishBlockers` rule |
| `provider.test.ts` | Identifier validation; record mapping (name+image together); search `data`-**array** vs lookup `data`-**object** parsing; 401/404/429/5xx error mapping; status leaks no key |
| `catalogService.test.ts` | Public catalog returns only verified/published/publishable records; drops invalid docs; `approveCandidate` keeps unpriced products unpublished |
| `routes.test.ts` | `/api/health`, honest `/api/status`, product list/detail (400/404/200), contact status + `503` without provider, admin `503` when unconfigured, structured 404 |

**Client smoke (`client/scripts/smoke.mjs`) — 21 checks, all passing here:** every route renders,
exact store facts present, logo fallback, demo record integrity, numeric RWF formatting, filter
/sort correctness, cart revalidation, URL-encoded WhatsApp messages, placeholder-email never a
`mailto:`, demo labelling, and honest loading/empty states.

### Authenticated vs mocked (read this before trusting the numbers)

- **Mocked** — every provider and MongoDB interaction in the test suite. No live KicksDB request
  and no database connection was performed in the environment where this was built.
- **Not yet verified in this environment:** live KicksDB calls, MongoDB reads/writes, and the
  contact-provider delivery path. Verify these yourself once `KICKSDB_API_KEY`, a MongoDB instance
  and (optionally) a contact provider are configured:

  ```bash
  npm run seed:demo
  npm --workspace server run dev
  # then open http://localhost:5173 and confirm real records appear and orders open WhatsApp
  ```

- `POST /api/admin/verify-provider` performs an authenticated provider check and reports the
  result honestly (including "no key configured").

---

## Owner inputs still required

1. **`KICKSDB_API_KEY`** in `server/.env` to enable live provider search/lookup.
2. **Official logo file** → `client/public/images/logo.png`.
3. **Store email address** → `storeConfig.email`.
4. **Verified product records** — names, images, colorways, SKUs, sizes, stock and real RWF
   selling prices, approved via the import workflow (retire demo records).
5. **Contact-form provider/endpoint** to enable real message delivery.
6. **Optional policies** — delivery charges, delivery timing, payment methods, returns.
7. **Promotion settings** — only if a discount is currently valid.
8. **Confirmation of any brand claims** — none are made anywhere today.

---

*Website developed by TETERO NSANZE Arnold*
