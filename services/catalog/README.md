# Catalog (owned — Fase 17)

Porta **4110**. Com `CATALOG_OWNED≠0` (default) trata categorias + produtos
(marketplace público, seller tenant, admin).

## Rotas owned

| Método | Path | Auth |
|---|---|---|
| GET | `/api/categories` | público |
| POST | `/api/categories` | staff + 2FA |
| POST | `/api/seller/categories` | JWT + tenant STORE |
| GET | `/api/products` | público (ACTIVE) |
| GET | `/api/products/:slugOrId` | público |
| GET | `/api/seller/products` | JWT + tenant |
| GET | `/api/admin/products` | staff + 2FA |
| POST/PATCH/DELETE | `/api/products*` | JWT + tenant |
| POST | `/api/products/:id/images` | JWT + tenant |

```bash
CATALOG_OWNED=1
CATALOG_URL=http://127.0.0.1:4110
pnpm --filter @ishopine/catalog dev
```
