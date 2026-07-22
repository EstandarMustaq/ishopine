# Fase 7 — Logistics carriers, wallet owned reads, media CDN stub

## Objectivo

Aprofundar **logistics** (carriers + shipments + checkout integrado),
extrair **leituras** da wallet (owned), e stubs de **transform/CDN** para media.

## Entregue

### Logistics
- Carriers: `FLAT_RATE`, `FREE_THRESHOLD`, `STORE_PICKUP`, `CORREIOS_MZ` (mock), `MANUAL`
- Prisma: `Shipment`, `ShipmentEvent`, enums `CarrierCode` / `ShipmentStatus`
- `GET /logistics/carriers`, `POST /logistics/quote` (peso + limiar)
- Checkout usa `LogisticsService` e cria `Shipment` PENDING
- Seller marca SHIPPED → gera etiqueta/tracking; DELIVERED → actualiza shipment
- Seller `/envios` — listar remessas + gerar etiqueta
- Outbox: `shipping.quote.requested`, `shipping.label.created`

### Wallet owned
- `services/wallet` com `WALLET_OWNED≠0`: `GET /api/wallet/me|tenant|ledger`
- Writes (settle) continuam no monólito

### Media CDN stub
- `buildMediaUrl()` em `@ishopine/shared` (Cloudinary URL transforms)
- Uploads Nest devolvem `variants.thumb` / `variants.card`

## Env

```bash
WALLET_OWNED=1
# MEDIA_OWNED=1 (Fase 6)
```

## Fora de âmbito
- APIs reais Correios/DHL
- Extrair writes Nest de orders/wallet
- Sharp local / CDN multi-região
