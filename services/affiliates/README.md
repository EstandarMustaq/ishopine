# Affiliates (owned — Fase 14)

Porta **4108**. Com `AFFILIATES_OWNED≠0` (default) trata links, cliques,
recompensas e conversão interna no settle.

## Rotas owned

| Método | Path | Auth |
|---|---|---|
| GET | `/api/affiliate/summary` | JWT |
| GET/POST | `/api/affiliate/links` | JWT |
| GET | `/api/affiliate/rewards` | JWT |
| POST | `/api/affiliate/click/:code` | público |
| PATCH | `/api/affiliate/rewards/:id/approve` | staff + 2FA |
| PATCH | `/api/affiliate/rewards/:id/pay` | staff + 2FA |
| POST | `/api/affiliate/internal/register-conversion` | `INTERNAL_SERVICE_SECRET` |

```bash
AFFILIATES_OWNED=1
AFFILIATES_URL=http://127.0.0.1:4108
# Nest settle:
# AFFILIATES_SETTLE_REMOTE=1
pnpm --filter @ishopine/affiliates dev
```
