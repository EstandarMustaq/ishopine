# Fase 32 — Nest HTTP retirement (PaySuite + settle-paid)

## Objectivo

Aprofundar retirement Nest **sem** inventar Correios HTTP (OpenAPI ausente):

1. Remover handlers Nest **PaySuite** (owned by `payments` since Fase 11–31).
2. Remover Nest **`POST /api/orders/internal/settle-paid`** (owned by `orders` since Fase 30).

## Entregue

### Nest billing
- Kept only `GET /api/billing/payments` (billing strangler also owns it)
- Removed Nest `paysuite/checkout|status|webhook|payouts|refunds` HTTP

### Nest orders
- Deleted `orders-internal.controller.ts`
- Kept `OrdersService.settlePaidOrders` for in-process Nest BillingService/commerce

### Production path
```bash
STRANGLER_ROUTING=1
PAYMENTS_URL=http://127.0.0.1:4102
ORDERS_URL=http://127.0.0.1:4101
PAYMENTS_OWNED=1
ORDERS_OWNED=1
```

Sem `ORDERS_URL`, payments settle deixa de ter fallback Nest HTTP.

### Correios
Sem mudança — gate Fase 29; `docs/contracts/` sem OpenAPI.

## Fora de âmbito
- Cliente HTTP Correios
- Remover Nest Auth local (fallthrough)
- Remover BillingService / OrdersService / MailModule
- Unregister Nest modules wholesale
