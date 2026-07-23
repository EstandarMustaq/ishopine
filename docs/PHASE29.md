# Fase 29 — Security extract + Correios OpenAPI gate

## Objectivo

1. Extrair **security** (compliance / findings / sync) do Nest para
   `services/platform-security` (`:4120`).
2. Formalizar o **gate Correios**: HTTP só quando OpenAPI/contrato real
   aterrar em `docs/contracts/` — **sem** cliente inventado.

## Entregue

### Platform-security (`PLATFORM_SECURITY_OWNED≠0`, :4120)
- `GET /api/security/compliance` — ADMIN (+ 2FA)
- `GET /api/security/findings` — ADMIN (+ 2FA)
- `POST /api/security/sync` — ADMIN (+ 2FA)
- `POST /api/security/findings/:id/acknowledge` — ADMIN (+ 2FA)

Boot sync best-effort (parity Nest `onModuleInit`). Outbox
`security.sync.completed` + projection `platform_security_sync` via Prisma;
tick continua em platform-ops.

### Gateway
- `/api/security` → `PLATFORM_SECURITY_URL`

### Correios (gate, sem HTTP)
- Partners report inclui `openapiPresent`, `openApiPath`, `adapterPresent`,
  `readyForAdapter`
- Path default: `docs/contracts/correios-mz.openapi.yaml`
  (ou `CORREIOS_MZ_OPENAPI_PATH`)
- `mode: "unavailable"` / `live: false` até OpenAPI **e** adapter
- Checklist: [docs/contracts/README.md](./contracts/README.md)

## Env

```bash
PLATFORM_SECURITY_OWNED=1
PLATFORM_SECURITY_URL=http://127.0.0.1:4120
# Correios (ainda bloqueado)
# CORREIOS_MZ_CONTRACTED=0
# CORREIOS_MZ_OPENAPI_PATH=docs/contracts/correios-mz.openapi.yaml
JWT_SECRET=...
DATABASE_URL=...
```

## Fora de âmbito
- Cliente HTTP Correios (contrato/OpenAPI ausente)
- Remover ReliabilityModule / idempotency do Nest
