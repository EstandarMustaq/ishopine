# Services — extracção gradual (strangler)

| Serviço | Estado | Notas |
|---|---|---|
| **identity** | **strangler proxy :4107** | `/api/auth` (SSO cookies no Nest) |
| accounts | domínio no monólito | Account/Tenant |
| marketplace | skeleton | Home/coleções |
| catalog | domínio no monólito | Híbrido Fase 2 |
| orders | strangler proxy :4101 | `/api/orders`, `/api/cart` |
| payments | strangler proxy :4102 | `/api/billing/paysuite` |
| commerce-orchestrator | compose :4100 | Saga checkout |
| wallet | strangler proxy :4103 | Ledger |
| billing | strangler proxy :4104 | Pricing + subscriptions |
| **media** | **owned :4105** | Upload/list locais (`MEDIA_OWNED`) |
| developers | strangler proxy :4106 | API keys / v1 / flags |
| feature-flags | módulo no monólito | via developers proxy |
| logistics | stub no monólito | `POST /api/logistics/quote` |

Helper partilhado: `@ishopine/shared` → `startStranglerProxy` (`mode`, `handleOwned`).

Gateway: `apps/gateway/README.md` (`STRANGLER_ROUTING=1`).
