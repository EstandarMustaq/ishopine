# Fase 8 — Production hardening (sem mocks)

## Objectivo

Remover teatro da Fase 7 e entregar logistics / media / wallet / orders / PaySuite
**prontos para carga real** — adapters reais, zonas DB, Sharp, authz, HMAC.

## Entregue

### Logistics
- Removido `CORREIOS_MZ` (legacy mapeia → `MANUAL`)
- `CarrierAdapter` + registry: `STORE_PICKUP`, `FLAT_RATE`, `FREE_THRESHOLD`, `MANUAL`
- Prisma `ShippingRateZone` (província/cidade MZ) + seed nacional
- Cotação por zona com fallback a `PlatformSettings`
- Etiquetas: tracking determinístico `ISH-{orderNumber}` (MANUAL exige tracking do seller)
- `GET /api/logistics/shipments/:id/label` → HTML imprimível (não stub JSON)
- `POST /api/logistics/webhooks/:carrier` + HMAC `x-carrier-signature` (`CARRIER_WEBHOOK_SECRET`)
- Outbox: `shipping.status.updated`
- Seller `/envios`: input tracking + link imprimir

### Media
- `sharp` no Nest uploads + `services/media` owned
- Variantes locais reais: `*_thumb.webp`, `*_card.webp`
- `buildMediaUrl` / `localVariantUrl` em `@ishopine/shared`

### Wallet owned
- `GET /api/wallet/tenant` exige membership activa (fecha IDOR)

### Orders owned
- `ORDERS_OWNED≠0`: leituras `mine` / `selling` / `:id` com authz Nest-parity
- Mutations continuam no monólito

### PaySuite
- `allowSimulate()`: `NODE_ENV=production` → nunca simula (flag não override)

## Env

```bash
ORDERS_OWNED=1
WALLET_OWNED=1
MEDIA_OWNED=1
CARRIER_WEBHOOK_SECRET=...
# Nunca PAYSUITE_SIMULATE em produção
```

## Migração dados (se havia CORREIOS_MZ)

```sql
UPDATE "Shipment" SET "carrierCode" = 'MANUAL' WHERE "carrierCode" = 'CORREIOS_MZ';
```

Depois `pnpm --filter @ishopine/api prisma:push`.

## Fora de âmbito
- Clientes HTTP live Correios/DHL
- Extrair writes Nest de orders/wallet
- CDN multi-região
