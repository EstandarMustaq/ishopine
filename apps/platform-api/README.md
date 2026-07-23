# Platform API — composition edge

Official production API entry for iShopine.

## Ownership rule

Domain logic lives **only** in `services/*/src/owned.ts`.
This app is **transport**: it routes each request to the owning handler.
There is **no Nest domain fallback**.

| Mode | When | Behavior |
|---|---|---|
| **Composition** (this app) | Production on Vercel | In-process dispatch to owned handlers |
| **Multi-process** | Local / container mesh | `apps/gateway` + `STRANGLER_ROUTING=1` + `*_URL` |

## Why composition on Vercel

Vercel cannot host 21 long-running Node processes. SaaS monorepos (Stripe-style package boundaries, Shopify modulith edge) keep **logical microservices** as packages and compose them at the edge until each service has its own host. Exclusive ownership is preserved: Nest does not implement catalog/auth/orders.

## Local

```bash
pnpm --filter @ishopine/shared build
pnpm -r --filter './services/*' run build
pnpm --filter @ishopine/platform-api dev   # :4000
```

## Health

`GET /api/health` → `{ mode: "composition", ownership: "services-exclusive", domains: [...] }`
