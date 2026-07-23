# Marketplace (owned — Fase 18)

Porta **4111**. Com `MARKETPLACE_OWNED≠0` (default) trata superfícies de
mercado: lojas, anúncios (home/coleções) e wishlist.

## Rotas owned

| Prefixo | Notas |
|---|---|
| `/api/shops` | list público, slug, mine, create/update, follow |
| `/api/ads` | público + admin CRUD |
| `/api/wishlist` | JWT |

Reviews de produto (`/api/products/:id/reviews`) → serviço **reviews**
(:4117, Fase 24) via gateway `pathRe` antes do catalog.

```bash
MARKETPLACE_OWNED=1
MARKETPLACE_URL=http://127.0.0.1:4111
pnpm --filter @ishopine/marketplace dev
```
