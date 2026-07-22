# Developers (owned — Fase 19)

Porta **4106**. Com `DEVELOPERS_OWNED≠0` (default) trata API keys, Commerce
API v1 (Bearer `ish_live_*`) e feature flags.

## Rotas owned

| Prefixo | Auth |
|---|---|
| `/api/developers/*` | JWT + tenant STORE |
| `/api/v1/*` | Bearer API key |
| `/api/feature-flags/*` | JWT (evaluate tenant / admin staff) |

Webhook **fan-out** (`deliverEvent`) permanece no Nest outbox.

```bash
DEVELOPERS_OWNED=1
DEVELOPERS_URL=http://127.0.0.1:4106
pnpm --filter @ishopine/developers dev
```
