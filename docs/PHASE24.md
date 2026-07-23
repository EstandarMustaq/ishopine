# Fase 24 — Coupons / inventory / reviews extracts

## Objectivo

Extrair as superfícies Nest de **cupões**, **inventário** e **reviews**
para serviços strangler com parity — sem teatro de carriers/CDN.

## Entregue

### Coupons (`COUPONS_OWNED≠0`, :4115)
- `GET /api/coupons` — ADMIN, OPERATOR
- `POST /api/coupons` — ADMIN
- `POST /api/coupons/validate` — público
- Redemption no checkout permanece em **orders**

### Inventory (`INVENTORY_OWNED≠0`, :4116)
- `GET /api/inventory/movements`
- `GET /api/inventory/low-stock`
- `POST /api/inventory/:productId/adjust`
- Auth: JWT + roles + TwoFactorGuard + TenantGuard parity
  (staff pode omitir `x-tenant-id`)
- Reserve/release no checkout/status permanece em **orders**

### Reviews (`REVIEWS_OWNED≠0`, :4117)
- `GET|POST /api/products/:id/reviews`
- Gateway: `pathRe` **antes** de `/api/products` → catalog
  (resolve colisão da Fase 18)

## Gateway

```bash
STRANGLER_ROUTING=1
COUPONS_URL=http://127.0.0.1:4115
INVENTORY_URL=http://127.0.0.1:4116
REVIEWS_URL=http://127.0.0.1:4117
```

## Env

```bash
COUPONS_OWNED=1
INVENTORY_OWNED=1
REVIEWS_OWNED=1
UPSTREAM_API_URL=http://127.0.0.1:4000
JWT_SECRET=...
DATABASE_URL=...
```

## Fora de âmbito
- Mover redemption de cupão / stock mutations do checkout para estes serviços
- Correios HTTP (continua indisponível — ver Fase 23)
- Inventar PoPs CDN
