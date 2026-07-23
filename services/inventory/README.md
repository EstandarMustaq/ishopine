# Inventory (owned — Fase 24)

Porta **4116**. Com `INVENTORY_OWNED≠0` (default) trata movements / low-stock / adjust.
Reserve/release no checkout e status de encomenda continua em **orders**.

## Rotas owned

| Método | Path | Auth |
|---|---|---|
| GET | `/api/inventory/movements` | ADMIN, OPERATOR, SELLER (+ 2FA + tenant) |
| GET | `/api/inventory/low-stock` | idem |
| POST | `/api/inventory/:productId/adjust` | idem |

Staff pode omitir `x-tenant-id` (Nest `TenantGuard` parity).

```bash
INVENTORY_OWNED=1
INVENTORY_URL=http://127.0.0.1:4116
pnpm --filter @ishopine/inventory dev
```
