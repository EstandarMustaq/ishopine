# Coupons (owned — Fase 24)

Porta **4115**. Com `COUPONS_OWNED≠0` (default) trata list/create/validate.
Redemption no checkout continua em **orders** (Nest + owned).

## Rotas owned

| Método | Path | Auth |
|---|---|---|
| GET | `/api/coupons` | ADMIN, OPERATOR |
| POST | `/api/coupons` | ADMIN |
| POST | `/api/coupons/validate` | público |

```bash
COUPONS_OWNED=1
COUPONS_URL=http://127.0.0.1:4115
pnpm --filter @ishopine/coupons dev
```
