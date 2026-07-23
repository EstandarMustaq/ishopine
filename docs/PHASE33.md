# Fase 33 — Nest HTTP retirement (platform-* surfaces)

## Objectivo

Retirar HTTP Nest já owned por platform-settings / platform-ops /
platform-security — **sem** inventar Correios HTTP (OpenAPI ausente).

## Entregue

### Deleted Nest HTTP
| Surface | Was Nest | Now |
|---|---|---|
| Dashboard + store/platform settings | `dashboard/*` | platform-settings `:4118` |
| Users admin (list/role/active) | `users` controller | platform-ops `:4119` |
| Reliability health/sync | `reliability` controller | platform-ops |
| Cron outbox | `cron` owned HTTP | platform-ops; Nest keeps **thin Vercel bridge** → `PLATFORM_OPS_URL` or inline dispatcher |
| Security compliance/findings/sync | `security` controller | platform-security `:4120` |

### Kept on Nest
- `ReliabilityModule` engine (inbox/outbox/projections/dispatcher)
- `SecurityModule` + boot `syncSystem` (no HTTP)
- `CronModule` thin bridge for `apps/api/vercel.json` cron path
- `UsersModule` address fallthrough (`GET|POST /api/addresses`)
- Auth local, commerce/billing services, etc.

### Production path
```bash
STRANGLER_ROUTING=1
PLATFORM_SETTINGS_URL=http://127.0.0.1:4118
PLATFORM_OPS_URL=http://127.0.0.1:4119
PLATFORM_SECURITY_URL=http://127.0.0.1:4120
```

Sem essas URLs, platform HTTP no monólito passa a 404.

### Correios
Sem mudança — gate Fase 29; `docs/contracts/` sem OpenAPI.

## Fora de âmbito
- Cliente HTTP Correios
- Coupons / inventory / reviews / comms Nest controllers → Fase 34+
- Remover Nest Auth / Reliability engine / Mail
