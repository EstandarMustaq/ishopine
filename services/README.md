# Services — extracção gradual (strangler)

| Serviço | Estado | Notas |
|---|---|---|
| identity | strangler proxy :4107 | `/api/auth` |
| accounts | domínio no monólito | Account/Tenant |
| marketplace | skeleton | Home/coleções |
| catalog | domínio no monólito | Híbrido Fase 2 |
| orders | strangler proxy :4101 | checkout/mutations Nest |
| payments | strangler proxy :4102 | PaySuite |
| commerce-orchestrator | compose :4100 | Saga checkout |
| **wallet** | **owned reads :4103** | GET me/tenant/ledger (`WALLET_OWNED`) |
| billing | strangler proxy :4104 | Pricing + subscriptions |
| media | owned :4105 | Upload/list + CDN URL stub |
| developers | strangler proxy :4106 | API keys / v1 / flags |
| logistics | módulo Nest | Carriers + shipments (Fase 7) |

Helper: `@ishopine/shared` → `startStranglerProxy`.
