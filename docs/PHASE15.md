# Fase 15 — Subscription extract (billing owned)

## Objectivo

Extrair **pricing + subscriptions + usage/invoices** para `services/billing`
(`BILLING_OWNED`) com parity Nest — e usage remoto no settle — sem teatro de
carriers HTTP nem multi-PoP CDN.

## Entregue

### Billing owned (`BILLING_OWNED≠0`, :4104)
- `GET /api/pricing/plans` (seed lazy dos planos FREE/STARTER/BUSINESS/ENTERPRISE)
- `GET /api/subscriptions/me` + `POST /api/subscriptions` (`x-tenant-id`)
- `GET /api/billing/usage`, `GET|POST /api/billing/invoices*`
- `GET /api/billing/payments`
- `POST /api/billing/internal/record-usage` — Bearer secret; **idempotente** por
  `tenantId + metric + reference`

### Nest settle remote
- `settlePaidOrders` → `BILLING_URL` quando `BILLING_USAGE_REMOTE≠0`
- Fallback in-process `SubscriptionsService.recordUsage`
- `recordUsage` Nest também idempotente por `reference` (settle seguro)

### Fallthrough
- `/api/billing/paysuite*`, legacy stripe/mpesa → Nest (gateway já manda
  paysuite para payments :4102)

## Env

```bash
BILLING_OWNED=1
BILLING_URL=http://127.0.0.1:4104
BILLING_USAGE_REMOTE=1
UPSTREAM_API_URL=http://127.0.0.1:4000
JWT_SECRET=...
DATABASE_URL=...
INTERNAL_SERVICE_SECRET=...
```

## Fora de âmbito
- Clientes HTTP Correios/DHL
- Multi-região CDN / PoPs
- Extrair PaySuite (já Fase 11–12 em payments)
- Accounts/tenant extract (Fase 16)
