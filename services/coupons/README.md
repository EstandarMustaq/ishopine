# Coupons (owned — Fase 24)

Porta **4115**. Com `COUPONS_OWNED≠0` (default) trata list/create/validate.
Redemption no checkout: inline em orders **ou** remoto via
`COUPON_REDEEM_REMOTE` → `POST /api/coupons/internal/redeem` (Fase 25).

## Rotas owned

| Método | Path | Auth |
|---|---|---|
| GET | `/api/coupons` | ADMIN, OPERATOR |
| POST | `/api/coupons` | ADMIN |
| POST | `/api/coupons/validate` | público |
| POST | `/api/coupons/internal/redeem` | Bearer internal |

```bash
COUPONS_OWNED=1
COUPONS_URL=http://127.0.0.1:4115
# COUPON_REDEEM_REMOTE=1
# INTERNAL_SERVICE_SECRET=...
pnpm --filter @ishopine/coupons dev
```
