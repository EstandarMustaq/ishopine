# Platform settings + dashboard (owned — Fase 27)

Porta **4118**. Com `PLATFORM_SETTINGS_OWNED≠0` (default):

| Método | Path | Auth |
|---|---|---|
| GET | `/api/dashboard/overview` | ADMIN, OPERATOR (+ 2FA) |
| GET | `/api/dashboard/charts` | ADMIN, OPERATOR (+ 2FA) |
| GET | `/api/store/settings` · `/api/platform/settings` | público |
| PATCH | `/api/store/settings` · `/api/platform/settings` | ADMIN (+ 2FA) |

```bash
PLATFORM_SETTINGS_OWNED=1
PLATFORM_SETTINGS_URL=http://127.0.0.1:4118
pnpm --filter @ishopine/platform-settings dev
```

Correios continua indisponível (sem OpenAPI/contrato).
