# API Gateway (strangler)

Ponto de entrada único. Fases 3–6: routing por prefixo quando
`STRANGLER_ROUTING=1` e as URLs dos serviços estão definidas.

## Rotas

| Prefixo | Env | Default port | Serviço |
|---|---|---|---|
| `/api/auth/*` | `IDENTITY_URL` | 4107 | identity |
| `/api/commerce/*` | `ORCHESTRATOR_URL` | 4100 | commerce-orchestrator |
| `/api/orders/*`, `/api/cart/*` | `ORDERS_URL` | 4101 | orders |
| `/api/billing/paysuite/*` | `PAYMENTS_URL` | 4102 | payments |
| `/api/wallet/*` | `WALLET_URL` | 4103 | wallet |
| `/api/pricing/*`, `/api/subscriptions/*`, `/api/billing/*` | `BILLING_URL` | 4104 | billing |
| `/api/media/*`, `/api/uploads/*` | `MEDIA_URL` | 4105 | media (owned default) |
| `/api/developers/*`, `/api/v1/*`, `/api/feature-flags/*` | `DEVELOPERS_URL` | 4106 | developers |
| resto (incl. `/api/logistics`) | `UPSTREAM_API_URL` | 4000 | monólito |

Wallet reads podem ser owned (`WALLET_OWNED=1` no serviço :4103).
Logistics permanece no monólito nesta fase.

Sem `STRANGLER_ROUTING=1`, **tudo** vai para o monólito.

## Cookie SSO (Fase 6)

Definir `COOKIE_DOMAIN` no monólito (ex. `.ishopine.com`) e
`NEXT_PUBLIC_COOKIE_SSO=1` nos frontends. Login grava `ishopine_session`
HttpOnly; apps usam `credentials: "include"`.
