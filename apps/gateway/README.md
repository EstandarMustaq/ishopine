# API Gateway (strangler)

Ponto de entrada único da plataforma. Nesta Fase 0 o gateway faz proxy
para o monólito `apps/api`. À medida que os serviços forem extraídos,
as rotas passam a ser encaminhadas por domínio.

## Rotas planeadas

| Prefixo | Destino actual | Destino futuro |
|---|---|---|
| `/api/auth/*` | monolith | `identity` |
| `/api/accounts/*` | monolith | `accounts` |
| `/api/products/*`, `/api/categories/*` | monolith | `catalog` |
| `/api/orders/*`, `/api/cart/*` | monolith | `orders` + orchestrator |
| `/api/billing/paysuite/*` | monolith | `payments` |
| `/api/wallet/*` | — | `wallet` |
| `/api/billing/*` (consumo) | — | `billing` |

## Arranque (Fase 0)

O gateway Nest mínimo vive em `apps/gateway` e encaminha tudo para
`UPSTREAM_API_URL` (default `http://localhost:4000`).
