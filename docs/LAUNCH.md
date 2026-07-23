# iShopine — produção live

Estado verificado em produção. Tudo abaixo está **no ar**.

## Superfícies (apps)

| App | URL | Project Vercel |
|-----|-----|----------------|
| Marketplace | https://ishopine.vercel.app | `ishopine` |
| API (composition) | https://ishopine-api.vercel.app | `ishopine-api` |
| Customer | https://ishopine-customer.vercel.app | `ishopine-customer` |
| Seller | https://ishopine-seller.vercel.app | `ishopine-seller` |
| Admin | https://ishopine-admin.vercel.app | `ishopine-admin` |
| Affiliate | https://ishopine-affiliate.vercel.app | `ishopine-affiliate` |
| Mobile | https://ishopine-mobile.vercel.app | `ishopine-mobile` |

Health da API:

```bash
curl -sS https://ishopine-api.vercel.app/api/health
# { "ok": true, "mode": "composition", "ownership": "services-exclusive", "domains": [20...] }
```

## Domínios (microserviços)

Não há hosts separados por serviço. Os **20** donos em `services/*` correm **dentro** da composition edge (`ishopine-api`). Header: `x-ishopine-owner`.

| Domínio | Exemplo |
|---------|---------|
| identity | `/api/auth/*` |
| affiliates | `/api/affiliates/*` |
| accounts | `/api/accounts/*` |
| marketplace | `/api/shops` |
| catalog | `/api/products`, `/api/categories` |
| reviews | `/api/reviews/*` |
| media | `/api/media/*` |
| orders | `/api/orders/*` |
| payments | `/api/payments/*` |
| wallet | `/api/wallet/*` |
| billing | `/api/billing/*` |
| developers | `/api/developers/*` |
| logistics | `/api/logistics/*` |
| accounting | `/api/accounting/*` |
| comms | `/api/comms/*` |
| coupons | `/api/coupons/*` |
| inventory | `/api/inventory/*` |
| platform-settings | `/api/platform/settings/*` |
| platform-ops | `/api/platform/ops/*` |
| platform-security | `/api/platform/security/*` |

Smoke rápido:

```bash
curl -sI https://ishopine-api.vercel.app/api/products | grep -i x-ishopine-owner
# x-ishopine-owner: catalog
```

## O que **não** está como host separado (de propósito)

| Componente | Motivo |
|------------|--------|
| `apps/gateway` | Proxy local / strangler; em produção a composition substitui |
| `apps/platform-api` | Build composition espelho; deploy canónico é `apps/api` → `ishopine-api` |
| Processos Nest por domínio | Domínio vive em `services/*/src/owned.ts` na composition |

## CORS

A API aceita origens de todos os frontends live (marketplace, customer, seller, admin, affiliate, mobile). Ver `apps/api/vercel.json`.

## Local (dev)

| App | Port | Command |
|-----|------|---------|
| Marketplace | 3000 | `pnpm dev:marketplace-web` |
| Seller | 3001 | `pnpm dev:seller-dashboard` |
| Admin | 3002 | `pnpm dev:admin` |
| Affiliate | 3003 | `pnpm dev:affiliate` |
| Customer | 3004 | `pnpm dev:customer` |
| Mobile web | 3005 | `pnpm dev:mobile` |
| API composition | 4000 | `pnpm --filter @ishopine/api start` (ou script do monorepo) |

Env: [ENV.md](./ENV.md) · deploy: [DEPLOY_PRODUCTION.md](./DEPLOY_PRODUCTION.md).  
PaySuite: `PAYSUITE_ENABLED=0` até quota merchant.

## Design

- Tokens Polaris: `@ishopine/design-system` — Brand `#008060`, topbar branca, sidebar `#1A1A1A`
- Brand tipográfica **iShopine** (sem logo pictórico)
- Magic Patterns: [design system](https://www.magicpatterns.com/design-system/ds-4571706d-048b-4a65-af2a-3f7929d815b5) · [inspirações](https://www.magicpatterns.com/inspiration/e84925f5-32b0-4df1-8aed-e52dae887aff)
