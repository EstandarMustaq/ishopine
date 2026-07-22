# Fase 3 — Orders / Payments strangler + Commerce Orchestrator

## Objectivo

Extrair a borda de **orders/cart** e **payments (PaySuite)** via strangler, e
introduzir o **commerce-orchestrator** (saga `validate → orders → payment`).

## Entregue

### Contratos (`packages/shared`)
- `CheckoutCommand`, `CheckoutSagaResult`, `CommerceSagaStep`
- `OutboxEventType`, `IDEMPOTENCY_SCOPES`, `GATEWAY_ROUTES`

### Serviços
| Serviço | Porta | Papel |
|---|---|---|
| `commerce-orchestrator` | 4100 | Compõe checkout (chama monólito) |
| `orders` | 4101 | Proxy strangler `/api/orders`, `/api/cart` |
| `payments` | 4102 | Proxy strangler `/api/billing/paysuite` |

### Gateway
- `STRANGLER_ROUTING=1` + `ORCHESTRATOR_URL` / `ORDERS_URL` / `PAYMENTS_URL`
- Sem flag → tudo no monólito (seguro)

### Monólito
- `POST /api/commerce/checkout` — mesma saga in-process (Orders + Billing + outbox)
- Marketplace checkout usa este endpoint
- Afiliados: `PATCH /affiliate/rewards/:id/approve` e `.../pay` (staff)

## Arranque strangler

```bash
pnpm dev:api
pnpm --filter @ishopine/commerce-orchestrator dev
pnpm --filter @ishopine/orders dev
pnpm --filter @ishopine/payments dev
STRANGLER_ROUTING=1 \
  ORCHESTRATOR_URL=http://127.0.0.1:4100 \
  ORDERS_URL=http://127.0.0.1:4101 \
  PAYMENTS_URL=http://127.0.0.1:4102 \
  pnpm dev:gateway
```

## Próximo (Fase 4)

- Wallet + Billing (consumo/premium) + Pricing
- Mover lógica Nest de orders/billing para os serviços (deixar de ser só proxy)
- Cookie SSO domínio partilhado
