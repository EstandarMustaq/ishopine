# Fase 27 — Platform settings / dashboard extract

## Objectivo

Extrair **dashboard** (overview/charts) e **store/platform settings** do Nest
para `services/platform-settings` (`:4118`).

Correios continua **bloqueado** (sem OpenAPI/contrato) — sem cliente HTTP.

## Entregue

### Platform-settings (`PLATFORM_SETTINGS_OWNED≠0`, :4118)
- `GET /api/dashboard/overview` — ADMIN, OPERATOR (+ 2FA)
- `GET /api/dashboard/charts` — ADMIN, OPERATOR (+ 2FA)
- `GET /api/store/settings` · `/api/platform/settings` — público
- `PATCH` settings — ADMIN (+ 2FA)

### Gateway
- `/api/dashboard`, `/api/store/settings`, `/api/platform/settings` →
  `PLATFORM_SETTINGS_URL`

### Correios
Sem mudança live — partners `unavailable` (ver Fase 26).

## Env

```bash
PLATFORM_SETTINGS_OWNED=1
PLATFORM_SETTINGS_URL=http://127.0.0.1:4118
UPSTREAM_API_URL=http://127.0.0.1:4000
JWT_SECRET=...
DATABASE_URL=...
```

## Fora de âmbito
- Cliente HTTP Correios
- Users admin / reliability / cron extract
