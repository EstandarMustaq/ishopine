# commerce-orchestrator

Saga de checkout da plataforma (Fases 3 + **25**).

```
validate → create_orders → create_payment → done
```

Compõe os stranglers quando as URLs estão definidas:

- `ORDERS_URL` (fallback `UPSTREAM_API_URL`) → `/api/orders/checkout`
- `PAYMENTS_URL` (fallback `UPSTREAM_API_URL`) → `/api/billing/paysuite/checkout`

`POST /api/commerce/checkout`

## Env

```bash
PORT=4100
UPSTREAM_API_URL=http://127.0.0.1:4000
ORDERS_URL=http://127.0.0.1:4101
PAYMENTS_URL=http://127.0.0.1:4102
```
