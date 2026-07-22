# Fase 18 — Marketplace extract (shops / ads / wishlist)

## Objectivo

Extrair as **superfícies de mercado** (lojas, anúncios da home, wishlist) para
`services/marketplace` (`MARKETPLACE_OWNED`) com parity Nest — sem teatro de
Correios/DHL nem multi-PoP CDN.

## Entregue

### Marketplace owned (`MARKETPLACE_OWNED≠0`, :4111)
- **Shops:** `GET /shops`, `GET /shops/:slug`, `GET /shops/mine`,
  `POST /shops`, `PATCH /shops/:id`, follow/unfollow/following
  (create auto-liga tenant STORE)
- **Ads:** `GET /ads?slot=`, `GET /ads/admin`, admin CRUD (`PLATFORM_ADMIN` + 2FA)
- **Wishlist:** `GET|POST /wishlist`, `DELETE /wishlist/:productId`

### Gateway
- `/api/shops`, `/api/ads`, `/api/wishlist` → `MARKETPLACE_URL`

### Fallthrough Nest
- `GET|POST /api/products/:id/reviews` — via catalog proxy fallthrough
  (prefixo `/api/products` → catalog → Nest)

## Env

```bash
MARKETPLACE_OWNED=1
MARKETPLACE_URL=http://127.0.0.1:4111
UPSTREAM_API_URL=http://127.0.0.1:4000
JWT_SECRET=...
DATABASE_URL=...
```

## Fora de âmbito
- Clientes HTTP Correios/DHL
- Multi-região CDN / PoPs
- Extrair reviews para path dedicado (colisão com catalog `/api/products`)
- Notifications / disputes / messages
- Developers / API keys / feature-flags → **Fase 19** ([PHASE19.md](./PHASE19.md))
