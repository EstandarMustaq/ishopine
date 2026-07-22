# Logistics (owned — Fase 20)

Porta **4112**. Com `LOGISTICS_OWNED≠0` (default) trata cotações, envios,
etiquetas HTML e webhooks HMAC — adapters reais (`FLAT_RATE`, `FREE_THRESHOLD`,
`STORE_PICKUP`, `MANUAL`) + zonas `ShippingRateZone`.

**Não** inclui clientes HTTP Correios/DHL nem CDN multi-região.

## Rotas owned

| Método | Path | Auth |
|---|---|---|
| GET | `/api/logistics/carriers` | público |
| POST | `/api/logistics/quote` | público |
| POST | `/api/logistics/webhooks/:carrier` | HMAC `x-carrier-signature` |
| GET | `/api/logistics/shipments` | JWT + tenant STORE |
| GET | `/api/logistics/shipments/:id` | JWT |
| POST | `/api/logistics/shipments/:orderId/label` | JWT + STORE |
| POST | `/api/logistics/shipments/:id/transit` | JWT + STORE |
| POST | `/api/logistics/shipments/:id/delivered` | JWT + STORE |
| GET | `/api/logistics/shipments/:id/label` | HTML público |

Checkout (`services/orders`) deve apontar `LOGISTICS_URL` para cotações.

```bash
LOGISTICS_OWNED=1
LOGISTICS_URL=http://127.0.0.1:4112
CARRIER_WEBHOOK_SECRET=...
pnpm --filter @ishopine/logistics dev
```
