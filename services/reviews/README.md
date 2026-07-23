# Reviews (owned — Fase 24)

Porta **4117**. Com `REVIEWS_OWNED≠0` (default) trata avaliações de produto.

Gateway: rota com `pathRe` **antes** de `/api/products` → catalog
(resolve a colisão documentada na Fase 18).

## Rotas owned

| Método | Path | Auth |
|---|---|---|
| GET | `/api/products/:id/reviews` | público |
| POST | `/api/products/:id/reviews` | JWT |

```bash
REVIEWS_OWNED=1
REVIEWS_URL=http://127.0.0.1:4117
pnpm --filter @ishopine/reviews dev
```
