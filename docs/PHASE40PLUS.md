# Fase 40+ — Roadmap (Correios + Nest endgame)

## Objectivo

Trabalho **bloqueado** ou de longo prazo depois da extracção strangler
(Fases 0–40). Não inventar HTTP Correios nem decommission prematuro.

## 1. Correios de Moçambique (HTTP adapter)

**Gate:** [docs/contracts/README.md](./contracts/README.md)

Checklist (todos obrigatórios):

1. Contrato comercial/API assinado com Correios MZ
2. OpenAPI em `docs/contracts/correios-mz.openapi.yaml`
   (ou `CORREIOS_MZ_OPENAPI_PATH`)
3. Adapter gerado **a partir desse OpenAPI** em
   `services/logistics/src/carriers/`
4. Env: `CORREIOS_MZ_CONTRACTED=1` + `CORREIOS_MZ_API_*`
5. Partners report: `mode: "http"` / `configured: true` / `live: true`

Até lá: `mode: "unavailable"`, `mapsTo: "MANUAL"`, `live: false`.

## 2. Nest DI / service decommission

Quando **todos** os settles/checkouts forem sempre remotos em produção
(`*_REMOTE≠0` + URLs always set) e o cron Vercel apontar só a
`PLATFORM_OPS_URL`:

| Remnant | Exit criteria |
|---|---|
| OrdersService settle fallthrough | Orders always owns settle; Billing/commerce never call Nest |
| Wallet/Affiliate/Subscriptions/Logistics Nest services | No Nest callers |
| BillingService / CommerceService | Orchestrator + payments only |
| AccountsService / TenantGuard | No Nest module needs in-process tenant resolve |
| NotificationsService / DevelopersService / Mail | Outbox fully on platform-ops (or dedicated worker) |
| Reliability engine in Nest | platform-ops owns dispatcher; Nest cron bridge deleted |
| `apps/api` Nest app | Optional: replace with tiny health/cron worker or retire Vercel Nest entry |

## 3. Explicitly out of scope until gates clear

- Invented Correios quote/label clients
- Multi-país / multi-currency
- Admin omnipotente de sellers
- Rewriting stranglers without production traffic proof
