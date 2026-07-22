# Services — extracção gradual (strangler)

| Serviço | Estado | Notas |
|---|---|---|
| identity | skeleton | Auth/IAM — monólito |
| accounts | domínio no monólito | Account/Tenant |
| marketplace | skeleton | Home/coleções |
| catalog | domínio no monólito | Híbrido Fase 2 |
| **orders** | **strangler proxy :4101** | `/api/orders`, `/api/cart` |
| **payments** | **strangler proxy :4102** | `/api/billing/paysuite` |
| **commerce-orchestrator** | **compose :4100** | Saga checkout |
| wallet | skeleton | Fase 4 |
| billing | skeleton | Consumo/premium — Fase 4 |

Gateway: ver `apps/gateway/README.md` (`STRANGLER_ROUTING=1`).
