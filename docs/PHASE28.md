# Fase 28 — Platform ops (users admin / reliability / cron)

## Objectivo

Extrair **users admin**, **reliability health/sync** e **cron outbox** do Nest
para `services/platform-ops` (`:4119`).

Correios continua **bloqueado** (sem OpenAPI/contrato) — sem cliente HTTP.

## Entregue

### Platform-ops (`PLATFORM_OPS_OWNED≠0`, :4119)
- `GET /api/users` — ADMIN (+ 2FA)
- `PATCH /api/users/:id/role` · `/active` — ADMIN (+ 2FA)
- `GET /api/reliability/health` — ADMIN, OPERATOR (+ 2FA)
- `POST /api/reliability/sync` — ADMIN, OPERATOR (+ 2FA)
- `GET|POST /api/cron/outbox` — `Bearer ${CRON_SECRET}`

Outbox tick inclui projections, notificações (Prisma) e fan-out de webhooks
merchant (parity Nest).

### Gateway
- `/api/users`, `/api/reliability`, `/api/cron` → `PLATFORM_OPS_URL`

### Correios
Sem mudança live — partners `unavailable` (ver Fase 26).

## Env

```bash
PLATFORM_OPS_OWNED=1
PLATFORM_OPS_URL=http://127.0.0.1:4119
CRON_SECRET=...
UPSTREAM_API_URL=http://127.0.0.1:4000
JWT_SECRET=...
DATABASE_URL=...
```

## Fora de âmbito
- Cliente HTTP Correios
- Addresses (accounts `:4109`)
- Dashboard / settings (platform-settings `:4118`)
- Inbox/outbox writers + idempotency interceptor (permanecem no Nest)
- Security module (`/api/security/*`) → **Fase 29** (`platform-security`)
