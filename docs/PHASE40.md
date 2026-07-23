# Fase 40 — Nest JWT/AuthModule slim + remnant inventory

## Objectivo

Após Fase 39 (sem HTTP JWT Nest), remover o stack Auth/JWT morto e
documentar o remanescente do monólito — **sem** inventar Correios HTTP.

## Entregue

### Removed
- `apps/api/src/auth/*` — AuthService, JwtStrategy, JwtAuthGuard, cookies, DTOs
- Nest JWT guards/decorators unused (`TwoFactorGuard`, `RolesGuard`, `CurrentUser`, `@Roles`)

### Nest remnant inventory (HTTP)
| Path | Role |
|---|---|
| `GET /api/health` | `AppController` |
| `GET\|POST /api/cron/outbox` | Thin Vercel bridge → `PLATFORM_OPS_URL` (or in-process Outbox) |

### Nest remnant inventory (DI / engines — no public domain HTTP)
| Module | Why kept |
|---|---|
| Reliability / Outbox / Projections | Engine + Nest cron fallback |
| SecurityModule | Boot `syncSystem` |
| MailModule + NotificationsService | Outbox email delivery |
| DevelopersService | Outbox webhooks |
| OrdersService + Wallet/Affiliate/Subscriptions/Logistics | Settle / quote fallthrough |
| BillingService + CommerceService | Nest checkout fallthrough |
| AccountsService + TenantGuard | In-process authz for remaining services |
| FeatureFlagsService | Boot seed |
| PricingService | Subscriptions DI |

### Production path
All domain traffic via gateway `STRANGLER_ROUTING=1` + service URLs.
Monolith remains `UPSTREAM_API_URL` only for health/cron and any unset routes (404).

### Correios
Sem mudança — gate Fase 29; ver **Fase 40+** ([PHASE40PLUS.md](./PHASE40PLUS.md)).

## Fora de âmbito
- Cliente HTTP Correios
- Remover DI services / Reliability engine → **Fase 40+**
- Drop unused npm deps (`passport`, `@nestjs/jwt`, …) — opcional follow-up
