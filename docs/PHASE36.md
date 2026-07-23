# Fase 36 — Nest HTTP retirement (accounts / affiliate / accounting)

## Objectivo

Retirar HTTP Nest já owned por accounts / affiliates / accounting —
**sem** inventar Correios HTTP (OpenAPI ausente).

## Entregue

### Deleted Nest HTTP
| Nest | Strangler | Notes |
|---|---|---|
| `accounts.controller` | accounts `:4109` | `AccountsService` + `TenantGuard` kept |
| `users` addresses fallthrough | accounts `:4109` | module removed (unused) |
| `affiliate.controller` | affiliates `:4108` | `AffiliateService` kept for settle fallback |
| `accounting/*` | accounting `:4113` | full delete (no Nest DI consumers) |

### Kept on Nest
- `AccountsModule` — service + tenant guard for Nest authz
- `AffiliateModule` — service for `OrdersService` settle fallback
- Wallet/billing HTTP → **Fase 37** ([PHASE37.md](./PHASE37.md)); media/developers/logistics (seguintes)
- Auth, orders/cart, NotificationsService, Reliability engine

### Production path
```bash
STRANGLER_ROUTING=1
ACCOUNTS_URL=http://127.0.0.1:4109
AFFILIATES_URL=http://127.0.0.1:4108
ACCOUNTING_URL=http://127.0.0.1:4113
```

Sem essas URLs, rotas caem no monólito e passam a 404.

### Correios
Sem mudança — gate Fase 29; `docs/contracts/` sem OpenAPI.

## Fora de âmbito
- Cliente HTTP Correios
- Remover Nest Auth / Reliability / NotificationsService
- Remover Nest wallet/billing/pricing/subscriptions/commerce HTTP → **Fase 37** ([PHASE37.md](./PHASE37.md))
- Remover Nest media/developers/logistics HTTP → **Fase 38** ([PHASE38.md](./PHASE38.md))
- Remover AccountsService / AffiliateService / TenantGuard (ainda DI Nest)
