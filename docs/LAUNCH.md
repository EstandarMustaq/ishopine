# iShopine V2 — launch guide

## Surfaces (local)

| App | Port | Command |
|---|---|---|
| Marketplace (`apps/web`) | 3000 | `pnpm dev:web` |
| Seller | 3001 | `pnpm dev:seller` |
| Backoffice | 3002 | `pnpm dev:backoffice` |
| Affiliate | 3003 | `pnpm dev:affiliate` |
| Customer account | 3004 | `pnpm dev:customer` |
| Mobile web (PWA) | 3005 | `pnpm dev:mobile` |
| Nest API shell | 4000 | `pnpm dev:api` |
| Gateway + stranglers | 4100+ | see `docs/MONOREPO.md` |

## Design system

- Tokens: `@ishopine/design-system` — Brand Green `#008060`, top bar `#1A1A1A`, sidebar `#F1F1F1`
- UI: `@ishopine/ui` — AdminShell, PageHeader, IndexTable, Banner, Button, Card, EmptyState, Badge
- Docs: [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)

## Auth handoff

- Marketplace login supports `?next=customer` → handoff to customer app
- Localhost uses one-time `?token=`; production uses cookie SSO (`COOKIE_DOMAIN`)

## Environment & secrets

See **[ENV.md](./ENV.md)** — checklist of credentials you provide vs secrets we generate.
PaySuite stays off (`PAYSUITE_ENABLED=0`) until merchant quota is approved.

## Deploy notes

- Root `vercel.json` still builds `@ishopine/web` by default
- Deploy customer / mobile / seller / backoffice / affiliate as separate Vercel projects (same monorepo, different root directories)
- Set `NEXT_PUBLIC_*_URL` and `CORS_ORIGIN` for all frontends

## Out of scope (still gated)

- Correios HTTP clients require OpenAPI under `docs/contracts/` (not invented)
- PaySuite live charges until `PAYSUITE_ENABLED=1` + token + webhook secret
