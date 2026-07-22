# Fase 12 — Payouts/refunds owned + CDN cache harden

## Objectivo

Completar o extract PaySuite (**payouts + refunds** admin) e endurecer a
entrega de media local com **Cache-Control** real — sem teatro de Correios
nem multi-PoP CDN.

## Entregue

### Payments owned
- `POST /api/billing/paysuite/payouts` — JWT + `PLATFORM_ADMIN|OPERATOR` + 2FA
- `POST /api/billing/paysuite/refunds` — mesma authz; full refund → `REFUNDED`
- Checkout / status / webhook (Fase 11) inalterados

### CDN / media harden
- Nest `useStaticAssets('/uploads')` → `Cache-Control: public, max-age=31536000, immutable` (imagens)
- Media owned serve `GET /uploads/*` do disco com os mesmos headers
- Gateway: prefixo `/uploads` → `MEDIA_URL` quando `STRANGLER_ROUTING=1`

## Env

```bash
PAYMENTS_OWNED=1
MEDIA_OWNED=1
MEDIA_URL=http://127.0.0.1:4105
# MEDIA_PUBLIC_BASE_URL=https://cdn.ishopine.com  # ou API/media
PAYSUITE_TOKEN=...
```

## Fora de âmbito
- Clientes HTTP Correios/DHL
- Multi-região CDN / PoPs inventados
- Affiliate/subscription extract
- Identity extract (Fase 13)
- Cloudinary signed URLs (assets públicos)
