# Platform ops — users admin + reliability + cron (owned — Fase 28)

Porta **4119**. Com `PLATFORM_OPS_OWNED≠0` (default):

| Método | Path | Auth |
|---|---|---|
| GET | `/api/users` | ADMIN (+ 2FA) |
| PATCH | `/api/users/:id/role` | ADMIN (+ 2FA) |
| PATCH | `/api/users/:id/active` | ADMIN (+ 2FA) |
| GET | `/api/reliability/health` | ADMIN, OPERATOR (+ 2FA) |
| POST | `/api/reliability/sync` | ADMIN, OPERATOR (+ 2FA) |
| GET/POST | `/api/cron/outbox` | `Bearer ${CRON_SECRET}` |

Addresses ficam em accounts (`:4109`). Inbox/outbox writers e idempotency continuam no Nest.

```bash
PLATFORM_OPS_OWNED=1
PLATFORM_OPS_URL=http://127.0.0.1:4119
CRON_SECRET=...
pnpm --filter @ishopine/platform-ops dev
```

Correios continua indisponível (sem OpenAPI/contrato).
