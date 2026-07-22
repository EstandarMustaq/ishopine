# Fase 9 — Orders write extract + media CDN parity

## Objectivo

Extrair **writes de alto tráfego** (cart + status de pedido) para o serviço
orders, e fechar parity Cloudinary / CDN no media owned — **sem mocks**.

Checkout e settle de wallet continuam no Nest (acoplamento payments/inventory).

## Entregue

### Orders owned (`ORDERS_OWNED≠0`)
- **Cart**: GET/POST/PATCH/DELETE `/api/cart*` com parity Nest (`CartService`)
- **Status**: `PATCH /api/orders/:id/status` com inventory, accounting, 2FA/roles
- Authz mais estrita: seller só actualiza pedidos da sua loja (+ tenant match)
- Side-effects SHIPPED/DELIVERED: etiqueta/entrega no mesmo DB + outbox
  `shipping.label.created`
- **Checkout** permanece Nest / orchestrator

### Media owned
- `UPLOAD_PROVIDER=cloudinary` → upload Cloudinary real (parity Nest)
- `DELETE /api/media|:id` e `/api/uploads/:id` owned
- `MEDIA_PUBLIC_BASE_URL` + `publicMediaUrl()` / `buildMediaUrl()` absolutizam
  paths locais atrás de CDN/API pública

### Docs
- `docs/PHASE9.md`, `ARCHITECTURE.md`, `services/README.md`

## Env

```bash
ORDERS_OWNED=1
MEDIA_OWNED=1
MEDIA_PUBLIC_BASE_URL=https://api.ishopine.com   # ou CDN
UPLOAD_PROVIDER=local|cloudinary
# CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET
```

## Fora de âmbito
- Extrair `POST /orders/checkout` (saga payments/inventory)
- Extrair `WalletService.settleOrderPayout`
- Cliente HTTP Correios/DHL (sem contrato de API pública útil)
- CDN multi-região / PoPs
