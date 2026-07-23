# Fase 37 — Nest HTTP retirement (wallet / billing / pricing / subscriptions / commerce)

## Objectivo

Retirar HTTP Nest já owned por wallet / billing / orchestrator —
**sem** inventar Correios HTTP (OpenAPI ausente).

## Entregue

### Deleted Nest HTTP (services kept for DI)
| Nest controller | Strangler |
|---|---|
| `wallet.controller` | wallet `:4103` |
| `billing.controller` | billing `:4104` (+ payments for PaySuite) |
| `pricing.controller` | billing `:4104` |
| `subscriptions.controller` | billing `:4104` |
| `commerce.controller` | commerce-orchestrator `:4100` |

### Kept on Nest
- `WalletService` — OrdersService settle fallback
- `BillingService` / `CommerceService` — Nest checkout fallthrough
- `PricingService` / `SubscriptionsService` — usage settle fallback
- Media/developers/logistics/auth/orders HTTP (próximas fases)
- AccountsService / TenantGuard / AffiliateService / NotificationsService

### Production path
```bash
STRANGLER_ROUTING=1
ORCHESTRATOR_URL=http://127.0.0.1:4100
WALLET_URL=http://127.0.0.1:4103
BILLING_URL=http://127.0.0.1:4104
PAYMENTS_URL=http://127.0.0.1:4102
```

Sem essas URLs, rotas caem no monólito e passam a 404.

### Correios
Sem mudança — gate Fase 29; `docs/contracts/` sem OpenAPI.

## Fora de âmbito
- Cliente HTTP Correios
- Remover Nest Auth / Reliability / NotificationsService
- Remover Nest media/developers/feature-flags/logistics/orders/cart HTTP
- Remover finance services (ainda DI Nest)
