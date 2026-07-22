# Fase 17 — Catalog extract (catalog owned)

## Objectivo

Extrair o **catálogo híbrido** (categorias GLOBAL/STORE + produtos) para
`services/catalog` (`CATALOG_OWNED`) com parity Nest — sem teatro de
Correios/DHL nem multi-PoP CDN.

## Entregue

### Catalog owned (`CATALOG_OWNED≠0`, :4110)
- Público: `GET /categories`, `GET /products`, `GET /products/:slugOrId`
- Seller: `GET /seller/products`, `POST /seller/categories`,
  CRUD `POST|PATCH|DELETE /products*`, `POST /products/:id/images`
  (`x-tenant-id` + 2FA parity Nest)
- Admin: `POST /categories`, `GET /admin/products` (staff + 2FA)

### Gateway
- `/api/categories`, `/api/products`, `/api/seller/categories`,
  `/api/seller/products`, `/api/admin/products` → `CATALOG_URL`

## Env

```bash
CATALOG_OWNED=1
CATALOG_URL=http://127.0.0.1:4110
UPSTREAM_API_URL=http://127.0.0.1:4000
JWT_SECRET=...
DATABASE_URL=...
```

## Fora de âmbito
- Clientes HTTP Correios/DHL
- Multi-região CDN / PoPs
- Marketplace home/coleções extract
- Remotizar TenantGuard Nest (continua in-process noutros módulos)
