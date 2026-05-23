# Inventory Dashboard — Vite App

React + TypeScript + Vite port of the HTML prototype. All UI is wired to the
real backend at `http://localhost:3000/api` (configurable). No auth — the API
client sends plain `fetch` requests with JSON.

## Quick start

```bash
cp .env.example .env.local
# edit VITE_API_PROXY_TARGET if your backend is not on http://localhost:3000

npm install
npm run dev
# → open http://localhost:5173
```

Vite proxies `/api/*` to the backend in dev, so the browser never hits CORS.

## Scripts

| Command            | What it does                                            |
|--------------------|---------------------------------------------------------|
| `npm run dev`      | Start Vite dev server with `/api` proxy → backend       |
| `npm run build`    | Type-check (`tsc -b`) and build for production         |
| `npm run preview`  | Serve the production build locally on :4173            |
| `npm run typecheck`| Run TypeScript without emitting anything               |

## Project layout

```
src/
  main.tsx                 entry point → mounts <App />
  App.tsx                  top-level shell, loading state, mutation handlers
  styles.css               unchanged from prototype + .app-shell overrides
  types.ts                 Product / Transaction / Tag / Location / API shapes

  api/
    client.ts              fetch wrapper, unwraps { success, data } envelope,
                           throws ApiError on failure
    products.ts            GET / POST / PUT / DELETE /api/products
                           + listAllProducts() that drains pagination
    transactions.ts        GET /api/transactions, POST /api/transactions
    batches.ts             POST /api/batches (atomic multi-item write)
    tags.ts                GET /api/tags
    locations.ts           GET /api/locations + /api/locations/:tag/content
    csv.ts                 POST /api/csv/import (multipart),
                           link helpers for /api/csv/export and /template

  lib/
    i18n.ts                EN / 中文 label dictionary + tagLabel()
    format.ts              fmtTime() / isToday()
    csv.ts                 client-side CSV parse/build (used by no UI yet —
                           kept for offline-style imports if you want them)

  components/
    Dashboard.tsx          KPI cards + Low stock + Recent transactions
    BatchFlow.tsx          Multi-item inbound/outbound batch flow
    ProductCombobox.tsx    Type-ahead product picker (used everywhere)
    Toast.tsx              Bottom-right notification w/ optional Undo
    modals/
      AdjustStockModal.tsx     single-transaction adjust
      ProductPickerModal.tsx   full-table browser
```

## API mapping

| UI action                 | API call                                                                  |
|---------------------------|---------------------------------------------------------------------------|
| Initial load              | `GET /api/products` (paginated, drained), `/api/transactions?limit=50`, `/api/tags`, `/api/locations` |
| Click low-stock row + save| `POST /api/transactions`                                                 |
| Undo toast                | `POST /api/transactions` with `quantity_change` negated (no DELETE on the API) |
| `+ Inbound` / `+ Outbound`| `POST /api/batches` with `items[]`                                       |
| CSV import                | `POST /api/csv/import` (multipart, field `file`)                          |
| CSV export                | `GET /api/csv/export` (browser download)                                  |

### Location handling

The prototype passed `location_tag` strings (e.g. `"A-01"`). The backend wants
`location_id` (integer) on writes. The form keeps the tag for display and
resolves it to an id at submit time via `locations.find(l => l.tag === ...)`.

### Stock validation

The backend rejects outbound transactions that would drive `accountable`
quantity below zero (`400` with `error` message). The Batch flow also runs the
same check client-side so the submit button is disabled before you even fire
the request — but the server is still the source of truth, and any error
surfaces in a red toast.

### Partial-failure batches

`POST /api/batches` can return `400` with `{ data: { successful: [...], failed: [...] } }`.
On that response the UI shows `❌ <message> (N failed)` and re-fetches
products + transactions so the dashboard reflects whatever items DID land.

## Configuration

Two environment variables (both optional):

| Var                       | Default                  | When to set                              |
|---------------------------|--------------------------|------------------------------------------|
| `VITE_API_PROXY_TARGET`   | `http://localhost:3000`  | Dev-only. Where `vite dev` proxies `/api/*`. |
| `VITE_API_BASE_URL`       | (same origin)            | Production. Set to your backend origin if frontend and backend are deployed separately. NO trailing slash. |

For same-origin deploys (nginx/Cloudflare/etc. fronting both the static build
and the API on one origin), leave `VITE_API_BASE_URL` unset and the client
sends bare `/api/*` requests.

## What's not wired up yet

The prototype is a **dashboard + adjust + batch flow** scope. The API
documents several surfaces this UI doesn't touch:

- **Product Units** (`/api/product-units/*`) — AP serial-number management
- **Webhooks** (`/api/webhooks/*`) — outbound event subscriptions
- **Updates / System / Health** — operational endpoints

The corresponding API client modules aren't included; add them as you build
the matching screens.

## Type safety notes

`tsconfig.json` runs with `"strict": false` to keep the porting friction low
(matches the JS prototype's looser style). Tighten as you go — start by
flipping `strictNullChecks: true` and walking the resulting errors.

## Deployment

```bash
npm run build      # writes dist/
```

Serve `dist/` as a static SPA. If frontend and backend are on the same origin,
nothing else needed. If they're separate, set `VITE_API_BASE_URL` at build
time and rebuild.
