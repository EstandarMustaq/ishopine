# Fase 35 — Nest HTTP retirement (marketplace / catalog)

## Objectivo

Retirar HTTP Nest já owned por marketplace e catalog —
**sem** inventar Correios HTTP (OpenAPI ausente).

## Entregue

### Deleted Nest modules (HTTP + unused services)
| Nest | Strangler |
|---|---|
| `shops/*`, `ads/*`, `wishlist/*` | marketplace `:4111` |
| `catalog/*` | catalog `:4110` |

### Kept on Nest
- `NotificationsModule` / `NotificationsService` — `OutboxDispatcher` DI
- Auth, accounts, orders/cart, wallet/billing, logistics, developers, etc.

### Production path
```bash
STRANGLER_ROUTING=1
CATALOG_URL=http://127.0.0.1:4110
MARKETPLACE_URL=http://127.0.0.1:4111
```

Sem essas URLs, rotas caem no monólito e passam a 404.

### Correios
Sem mudança — gate Fase 29; `docs/contracts/` sem OpenAPI.

## Fora de âmbito
- Cliente HTTP Correios
- Remover Nest Auth / Reliability / NotificationsService
- Remover Nest accounts/affiliate/accounting → **Fase 36** ([PHASE36.md](./PHASE36.md))
- Remover Nest wallet/billing/media/developers/logistics (próximas fases)
