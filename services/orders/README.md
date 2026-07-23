# orders (strangler)

Porta **4101**. Rotas: `/api/orders/*`, `/api/cart/*`.

## Modo owned (`ORDERS_OWNED≠0`, default)

| Método | Path | Owner |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/cart*` | **owned** |
| GET | `/api/orders/mine`, `/selling`, `/:id` | **owned** |
| PATCH | `/api/orders/:id/status` | **owned** |
| POST | `/api/orders/checkout` | **owned** (+ `Idempotency-Key`) |
| POST | `/api/orders/internal/settle-paid` | **owned** (Bearer internal; Fase 30) |

Checkout pede cotação a `LOGISTICS_URL/api/logistics/quote`
(fallback `UPSTREAM_API_URL`).

### Fase 25–30 — side-effects remotos (opcional)

```bash
COUPON_REDEEM_REMOTE=1
COUPONS_URL=http://127.0.0.1:4115
INVENTORY_RESERVE_REMOTE=1
INVENTORY_URL=http://127.0.0.1:4116
LOGISTICS_LABEL_REMOTE=1
LOGISTICS_URL=http://127.0.0.1:4112
AFFILIATES_SETTLE_REMOTE=1
AFFILIATES_URL=http://127.0.0.1:4108
WALLET_SETTLE_REMOTE=1
WALLET_URL=http://127.0.0.1:4103
BILLING_USAGE_REMOTE=1
BILLING_URL=http://127.0.0.1:4104
INTERNAL_SERVICE_SECRET=...
```

Sem flag/URL/secret → inline (parity).

## Proxy

`ORDERS_OWNED=0` → tudo para `UPSTREAM_API_URL`.
