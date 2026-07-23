# Inventory (owned — Fase 24)

Porta **4116**. Com `INVENTORY_OWNED≠0` (default) trata movements / low-stock / adjust.
Reserve/release/fulfill no checkout/status: inline em orders **ou** remoto via
`INVENTORY_RESERVE_REMOTE` (Fase 25).

## Rotas owned

| Método | Path | Auth |
|---|---|---|
| GET | `/api/inventory/movements` | ADMIN, OPERATOR, SELLER (+ 2FA + tenant) |
| GET | `/api/inventory/low-stock` | idem |
| POST | `/api/inventory/:productId/adjust` | idem |
| POST | `/api/inventory/internal/reserve` | Bearer internal |
| POST | `/api/inventory/internal/release` | Bearer internal |
| POST | `/api/inventory/internal/fulfill` | Bearer internal |

Staff pode omitir `x-tenant-id` (Nest `TenantGuard` parity).

```bash
INVENTORY_OWNED=1
INVENTORY_URL=http://127.0.0.1:4116
# INVENTORY_RESERVE_REMOTE=1
# INTERNAL_SERVICE_SECRET=...
pnpm --filter @ishopine/inventory dev
```
