# Fase 19 — Developers extract (API keys / v1 / flags)

## Objectivo

Extrair a **developer platform** (`/api/developers`, `/api/v1`,
`/api/feature-flags`) para `services/developers` (`DEVELOPERS_OWNED`) com
parity Nest — sem teatro de Correios/DHL nem multi-PoP CDN.

## Entregue

### Developers owned (`DEVELOPERS_OWNED≠0`, :4106)
- Console STORE: `status`, API keys CRUD, webhooks upsert/rotate
- Commerce API: `GET /v1/me|products|orders` (Bearer `ish_live_*`)
- Feature flags: evaluate (tenant), list/set/overrides (staff)
- Seed lazy das flags default (`developer_platform`, …)

### Nest
- Outbox `deliverEvent` / webhook fan-out permanece in-process

### Gateway
- Prefixos já existentes → `DEVELOPERS_URL`

## Env

```bash
DEVELOPERS_OWNED=1
DEVELOPERS_URL=http://127.0.0.1:4106
UPSTREAM_API_URL=http://127.0.0.1:4000
JWT_SECRET=...
DATABASE_URL=...
```

## Fora de âmbito
- Clientes HTTP Correios/DHL
- Multi-região CDN / PoPs
- Remover deliverEvent do Nest (fica outbox)
- Extrair logistics → **Fase 20** ([PHASE20.md](./PHASE20.md))
