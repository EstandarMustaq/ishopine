# iShopine V2 — launch guide

## Surfaces (local)

| App | Port | Command |
|---|---|---|
| Marketplace (`apps/marketplace-web`) | 3000 | `pnpm dev:marketplace-web` |
| Seller (`apps/seller-dashboard`) | 3001 | `pnpm dev:seller-dashboard` |
| Admin (`apps/admin`) | 3002 | `pnpm dev:admin` |
| Affiliate | 3003 | `pnpm dev:affiliate` |
| Customer | 3004 | `pnpm dev:customer` |
| Mobile web | 3005 | `pnpm dev:mobile` |
| Nest API shell | 4000 | `pnpm dev:api` |

## Design system

Brand Green `#008060` · top bar `#1A1A1A` · sidebar `#F1F1F1` — see [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md).

## Environment

See [ENV.md](./ENV.md) and [DEPLOY_PRODUCTION.md](./DEPLOY_PRODUCTION.md).
PaySuite: `PAYSUITE_ENABLED=0` until merchant quota.

## Seed

`pnpm db:seed` bootstraps org + categories + shipping zones only — **no demo users**.
Register via `/cadastro` or Google OAuth.
