# API Gateway (strangler)

Ponto de entrada único. Fases 3–5: routing por prefixo quando
`STRANGLER_ROUTING=1` e as URLs dos serviços estão definidas.

## Rotas

| Prefixo | Env | Default port | Serviço |
|---|---|---|---|
| `/api/commerce/*` | `ORCHESTRATOR_URL` | 4100 | commerce-orchestrator |
| `/api/orders/*`, `/api/cart/*` | `ORDERS_URL` | 4101 | orders |
| `/api/billing/paysuite/*` | `PAYMENTS_URL` | 4102 | payments |
| `/api/wallet/*` | `WALLET_URL` | 4103 | wallet |
| `/api/pricing/*`, `/api/subscriptions/*`, `/api/billing/*` | `BILLING_URL` | 4104 | billing |
| `/api/media/*`, `/api/uploads/*` | `MEDIA_URL` | 4105 | media |
| `/api/developers/*`, `/api/v1/*`, `/api/feature-flags/*` | `DEVELOPERS_URL` | 4106 | developers |
| resto | `UPSTREAM_API_URL` | 4000 | monólito |

Prefixos mais específicos vêm primeiro (PaySuite `/api/billing/paysuite`
antes de `/api/billing`).

Sem `STRANGLER_ROUTING=1`, **tudo** vai para o monólito (comportamento Fase 0–2).

## Arranque local (strangler ligado)

```bash
pnpm dev:api
pnpm --filter @ishopine/commerce-orchestrator dev
pnpm --filter @ishopine/orders dev
pnpm --filter @ishopine/payments dev
pnpm dev:wallet
pnpm dev:billing
pnpm dev:media
pnpm dev:developers

STRANGLER_ROUTING=1 \
  ORCHESTRATOR_URL=http://127.0.0.1:4100 \
  ORDERS_URL=http://127.0.0.1:4101 \
  PAYMENTS_URL=http://127.0.0.1:4102 \
  WALLET_URL=http://127.0.0.1:4103 \
  BILLING_URL=http://127.0.0.1:4104 \
  MEDIA_URL=http://127.0.0.1:4105 \
  DEVELOPERS_URL=http://127.0.0.1:4106 \
  UPSTREAM_API_URL=http://127.0.0.1:4000 \
  pnpm dev:gateway
```

Clientes apontam `NEXT_PUBLIC_API_URL` para o gateway (`:8080`).
