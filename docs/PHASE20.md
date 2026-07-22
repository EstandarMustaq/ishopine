# Fase 20 — Logistics extract (zones / shipments / webhooks)

## Objectivo

Extrair a superfície Nest de **logistics** para `services/logistics`
(`LOGISTICS_OWNED`) com parity — adapters + zonas DB + etiquetas HTML + HMAC.
Sem teatro de Correios/DHL nem multi-PoP CDN.

## Entregue

### Logistics owned (`LOGISTICS_OWNED≠0`, :4112)
- Carriers: `FLAT_RATE`, `FREE_THRESHOLD`, `STORE_PICKUP`, `MANUAL`
  (`CORREIOS_MZ` legacy → `MANUAL`)
- Cotação por `ShippingRateZone` + limiares `PlatformSettings`
- Shipments: list / get / label / transit / delivered
- Etiqueta HTML imprimível
- Webhooks carrier com HMAC `CARRIER_WEBHOOK_SECRET`
- Outbox writes: `shipping.quote.requested`, `shipping.label.created`,
  `shipping.status.updated` (dispatcher Nest)

### Gateway
- `/api/logistics` → `LOGISTICS_URL`

### Orders
- Checkout quote usa `LOGISTICS_URL` (fallback `UPSTREAM_API_URL`)

### Nest
- `LogisticsService` in-process permanece para checkout Nest fallthrough

## Env

```bash
LOGISTICS_OWNED=1
LOGISTICS_URL=http://127.0.0.1:4112
UPSTREAM_API_URL=http://127.0.0.1:4000
JWT_SECRET=...
DATABASE_URL=...
CARRIER_WEBHOOK_SECRET=...
```

## Fora de âmbito
- Clientes HTTP Correios / DHL / parceiros live
- Multi-região CDN / PoPs
- Remover `LogisticsService` do Nest (ainda usado in-process)
- Accounting ledger → **Fase 21** ([PHASE21.md](./PHASE21.md))
