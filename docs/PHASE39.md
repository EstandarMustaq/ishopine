# Fase 39 — Nest HTTP retirement (auth / orders / cart)

## Objectivo

Retirar o último HTTP de domínio Nest já owned por identity / orders —
**sem** inventar Correios HTTP (OpenAPI ausente).

## Entregue

### Deleted Nest HTTP
| Nest | Strangler | Notes |
|---|---|---|
| `auth.controller` | identity `:4107` | `AuthService` + Jwt kept (slim → Fase 40) |
| `orders.controller` | orders `:4101` | `OrdersService` kept for Billing/commerce fallthrough |
| `cart/*` (module) | orders `:4101` | full delete (OrdersService uses Prisma cart) |

### Nest HTTP edge after Phase 39
- `GET /api/health` — `AppController`
- `GET|POST /api/cron/outbox` — thin Vercel bridge → `PLATFORM_OPS_URL`

### Production path
```bash
STRANGLER_ROUTING=1
IDENTITY_URL=http://127.0.0.1:4107
ORDERS_URL=http://127.0.0.1:4101
```

Sem essas URLs, rotas caem no monólito e passam a 404.

### Correios
Sem mudança — gate Fase 29; `docs/contracts/` sem OpenAPI.

## Fora de âmbito
- Cliente HTTP Correios
- Remover AuthModule / JwtStrategy → **Fase 40** ([PHASE40.md](./PHASE40.md))
- Nest DI / Reliability endgame → **Fase 40+** ([PHASE40PLUS.md](./PHASE40PLUS.md)) — **entregue**
