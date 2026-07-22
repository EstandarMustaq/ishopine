# Billing (owned — Fase 15)

Porta **4104**. Com `BILLING_OWNED≠0` (default) trata pricing, subscrições,
usage/invoices e listagem de payments. PaySuite continua no serviço payments
(gateway) / fallthrough Nest.

## Rotas owned

| Método | Path | Auth |
|---|---|---|
| GET | `/api/pricing/plans` | público |
| GET | `/api/subscriptions/me` | JWT + `x-tenant-id` |
| POST | `/api/subscriptions` | JWT + tenant |
| GET | `/api/billing/usage` | JWT + tenant |
| GET/POST | `/api/billing/invoices*` | JWT + tenant |
| GET | `/api/billing/payments` | JWT |
| POST | `/api/billing/internal/record-usage` | `INTERNAL_SERVICE_SECRET` |

## Fallthrough

- `/api/billing/paysuite*`, `/stripe*`, `/mpesa*` → Nest (PaySuite owned em :4102 via gateway)

```bash
BILLING_OWNED=1
BILLING_URL=http://127.0.0.1:4104
# Nest settle:
# BILLING_USAGE_REMOTE=1
pnpm --filter @ishopine/billing dev
```
