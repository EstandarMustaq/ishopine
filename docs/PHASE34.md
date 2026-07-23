# Fase 34 — Nest HTTP retirement (coupons / inventory / reviews / comms)

## Objectivo

Retirar HTTP Nest já owned por coupons / inventory / reviews / comms —
**sem** inventar Correios HTTP (OpenAPI ausente).

## Entregue

### Deleted Nest modules (HTTP + unused services)
| Nest | Strangler |
|---|---|
| `coupons/*` | coupons `:4115` |
| `inventory/*` | inventory `:4116` |
| `reviews/*` | reviews `:4117` |
| `messages/*`, `disputes/*` | comms `:4114` |
| `notifications.controller` | comms (service kept) |

### Kept on Nest
- `NotificationsModule` / `NotificationsService` — `OutboxDispatcher` DI
- Reliability engine, auth, commerce/billing, shops, catalog, etc.

### Production path
```bash
STRANGLER_ROUTING=1
COUPONS_URL=http://127.0.0.1:4115
INVENTORY_URL=http://127.0.0.1:4116
REVIEWS_URL=http://127.0.0.1:4117
COMMS_URL=http://127.0.0.1:4114
```

Sem essas URLs, rotas caem no monólito e passam a 404.

### Correios
Sem mudança — gate Fase 29; `docs/contracts/` sem OpenAPI.

## Fora de âmbito
- Cliente HTTP Correios
- Remover Nest Auth / Reliability / NotificationsService
- Remover Nest shops/catalog/wishlist (marketplace/catalog owned separately)
