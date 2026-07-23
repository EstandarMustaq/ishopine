# Fase 40+ — Nest endgame (migração definitiva) + Correios gate

## Objectivo

Concluir a **migração definitiva** do monólito Nest: zero DI de domínio,
zero motor de outbox in-process. O edge Nest é só health + proxy de cron.
Correios HTTP permanece **bloqueado** até OpenAPI real em `docs/contracts/`.

## Entregue — Nest endgame

### Removido de `apps/api`
- Todos os módulos de domínio / fallthrough: accounts, affiliate, orders,
  wallet, billing, commerce, subscriptions, pricing, logistics, developers,
  feature-flags, notifications, mail, security, reliability, prisma (Nest)
- Fallback `nest-inline` do cron outbox

### Nest shell restante
| Path | Comportamento |
|---|---|
| `GET /api/health` | `{ ok, mode: "nest-shell", phase: "40+" }` |
| `GET\|POST /api/cron/outbox` | Proxy obrigatório → `PLATFORM_OPS_URL` + `CRON_SECRET` |

Sem `PLATFORM_OPS_URL` → `503` (não há motor Nest).

### Produção
```bash
STRANGLER_ROUTING=1
# … todas as *_URL dos stranglers …
PLATFORM_OPS_URL=http://127.0.0.1:4119   # obrigatório para Vercel cron Nest
UPSTREAM_API_URL=http://127.0.0.1:4000   # só health (+ cron bridge)
CRON_SECRET=...
```

Schema Prisma continua em `apps/api/prisma/` (fonte partilhada pelos serviços).
O processo Nest **não** abre Prisma Client.

### Vercel
`apps/api/vercel.json` mantém cron em `/api/cron/outbox` → shell Nest →
platform-ops. Alternativa futura: apontar o cron Vercel directamente a
platform-ops / gateway e retirar o deploy Nest.

## Correios MZ (ainda gated)

**Não entregue HTTP.** Checklist inalterado:

1. Contrato comercial/API assinado
2. `docs/contracts/correios-mz.openapi.yaml` (ou `CORREIOS_MZ_OPENAPI_PATH`)
3. Adapter gerado **desse** OpenAPI em `services/logistics/src/carriers/`
4. `CORREIOS_MZ_CONTRACTED=1` + credenciais
5. Partners: `mode: "http"` / `live: true`

Até lá: `unavailable` / `MANUAL` / `live: false`.

## Fora de âmbito (esta fase)
- Inventar cliente HTTP Correios
- Remover `apps/api` do monorepo / Vercel (opcional pós-produção)
- Limpeza npm (`passport`, `@nestjs/jwt`, `sharp`, …) — follow-up
