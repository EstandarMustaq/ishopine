# Fase 25 — Checkout saga splits (side-effect ownership)

## Objectivo

Aprofundar a saga de checkout **sem teatro de Correios**: side-effects
de cupão / stock / etiqueta passam a ser propriedade dos serviços da
Fase 24 (+ logistics), via APIs internas fail-closed e flags env.

O orchestrator passa a compor **ORDERS_URL** + **PAYMENTS_URL** (fallback Nest).

## Entregue

### Orchestrator (`:4100`)
- `ORDERS_URL` → `POST /api/orders/checkout`
- `PAYMENTS_URL` → `POST /api/billing/paysuite/checkout`
- Health reporta `ordersBase` / `paymentsBase`

### Coupons internal
- `POST /api/coupons/internal/redeem` (Bearer `INTERNAL_SERVICE_SECRET`)
- Idempotente em `couponId+orderId`
- Orders: `COUPON_REDEEM_REMOTE≠0` + `COUPONS_URL`

### Inventory internal
- `POST /api/inventory/internal/reserve|release|fulfill`
- Reserve = `reservedStock++` (+ movimento RESERVE para idempotência)
- Orders checkout/status: `INVENTORY_RESERVE_REMOTE≠0` + `INVENTORY_URL`

### Logistics internal
- `POST /api/logistics/internal/create-label` `{ orderId }`
- `POST /api/logistics/internal/mark-delivered` `{ orderId }`
- Orders SHIPPED/DELIVERED: `LOGISTICS_LABEL_REMOTE≠0` + `LOGISTICS_URL`

## Env

```bash
ORDERS_URL=http://127.0.0.1:4101
PAYMENTS_URL=http://127.0.0.1:4102
ORCHESTRATOR_URL=http://127.0.0.1:4100

COUPONS_URL=http://127.0.0.1:4115
COUPON_REDEEM_REMOTE=1

INVENTORY_URL=http://127.0.0.1:4116
INVENTORY_RESERVE_REMOTE=1

LOGISTICS_URL=http://127.0.0.1:4112
LOGISTICS_LABEL_REMOTE=1

INTERNAL_SERVICE_SECRET=...
```

Flags `=0` ou URL/secret em falta → **inline fallback** (parity Fase 10–24).

## Fora de âmbito
- Cliente HTTP Correios inventado (continua bloqueado — ver Fase 26)
- Extrair dashboard / users admin / reliability
