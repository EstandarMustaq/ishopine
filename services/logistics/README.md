# Logistics (owned — Fases 20–23)

Porta **4112**. Com `LOGISTICS_OWNED≠0` (default) trata cotações, envios,
etiquetas HTML e webhooks HMAC.

## Adapters

| Code | Modo |
|---|---|
| `FLAT_RATE`, `FREE_THRESHOLD`, `STORE_PICKUP`, `MANUAL` | local + zonas DB |
| `DHL_EXPRESS` | **live MyDHL** se credenciais; senão omitido nas cotações |
| `CORREIOS_MZ` (legacy) | → `MANUAL` (sem API) |

## Rotas owned

| Método | Path | Auth |
|---|---|---|
| GET | `/api/logistics/carriers` | público |
| GET | `/api/logistics/partners` | público (estado live) |
| POST | `/api/logistics/quote` | público |
| POST | `/api/logistics/webhooks/:carrier` | HMAC `x-carrier-signature` |
| GET | `/api/logistics/shipments` | JWT + tenant STORE |
| GET | `/api/logistics/shipments/:id` | JWT |
| POST | `/api/logistics/shipments/:orderId/label` | JWT + STORE |
| POST | `/api/logistics/shipments/:id/transit` | JWT + STORE |
| POST | `/api/logistics/shipments/:id/delivered` | JWT + STORE |
| GET | `/api/logistics/shipments/:id/label` | HTML público |
| POST | `/api/logistics/internal/create-label` | Bearer internal (Fase 25) |
| POST | `/api/logistics/internal/mark-delivered` | Bearer internal (Fase 25) |

```bash
LOGISTICS_OWNED=1
LOGISTICS_URL=http://127.0.0.1:4112
# LOGISTICS_LABEL_REMOTE=1
# INTERNAL_SERVICE_SECRET=...
# DHL_EXPRESS_API_KEY=… DHL_EXPRESS_API_SECRET=… DHL_EXPRESS_ACCOUNT_NUMBER=…
pnpm --filter @ishopine/logistics dev
```
