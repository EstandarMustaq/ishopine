# Services — extracção gradual (strangler)

| Serviço | Estado | Notas |
|---|---|---|
| identity | skeleton | Auth/IAM — monólito |
| accounts | domínio no monólito | Account/Tenant |
| marketplace | skeleton | Home/coleções |
| catalog | domínio no monólito | Híbrido Fase 2 |
| orders | strangler proxy :4101 | `/api/orders`, `/api/cart` |
| payments | strangler proxy :4102 | `/api/billing/paysuite` |
| commerce-orchestrator | compose :4100 | Saga checkout |
| **wallet** | **strangler proxy :4103** | Ledger / carteiras |
| **billing** | **strangler proxy :4104** | Pricing + subscriptions + usage |
| pricing / subscriptions | módulos no monólito | Expostos via billing service |

Gateway: `apps/gateway/README.md` (`STRANGLER_ROUTING=1`).
