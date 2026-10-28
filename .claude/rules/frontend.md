---
paths:
  - "vite-app/**"
---

# Frontend (`vite-app/`: React 18 + TypeScript + Vite)

## Layout
- `src/api/*.ts`: one module per backend resource; all calls go through `api` in `api/client.ts`.
- `src/components/`: pages (`*Page.tsx`) and shared pieces; dialogs live in `components/modals/`.
- `src/hooks/`: app state (`useSession`, `useInventory`, `useToast`, `useAppHandlers`, `useLang`).
- `src/context/ActiveWarehouseContext.tsx`: the selected warehouse.
- `src/lib/`: `routes.ts` (URL ↔ `View`), `i18n.ts`, `serial.ts`, `format.ts`.
- Shared types are in `src/types.ts`.

## API calls
- `api/client.ts` adds the token (`inv.token`) and `X-Warehouse-Id` (`inv.warehouseId`), unwraps `{ success, data }`, and throws `ApiError` on failure.
- `ApiError.message` and coded items of `err.body.errors` are already translated, so components just display them and don't parse server strings.

## Text and language
- UI text comes from `L[lang]` in `lib/i18n.ts` (`const t = L[lang]`), in four languages: `en`, `zh`, `zh-cn`, `ja`. Add every new key in all four.
- Server error codes are translated in `SERVER_ERRORS` in the same file (ADR 0004).

## Pages and routing
- The URL decides which page shows. A new page needs a `View` kind and a path in `lib/routes.ts`.

## Styling
- Global CSS in `src/styles.css`, with inline `style={{...}}` common in components. There are no CSS modules.

## Checks
- There are no frontend unit tests. Run `npm run typecheck` (or `npm run build`) in `vite-app/`, then check the change in the running app (`/run`).
- The dev server proxies `/api/*` to the backend (`vite.config.ts`).
