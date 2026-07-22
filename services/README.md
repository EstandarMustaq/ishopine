# Services — extracção gradual (strangler)

Serviços fundamentais (esqueleto nesta Fase 0):

| Serviço | Estado | Notas |
|---|---|---|
| identity | skeleton | Auth/IAM — ainda no monólito `apps/api/src/auth` |
| accounts | **domínio activo no monólito** | `apps/api/src/accounts` — Account/Tenant |
| marketplace | skeleton | Superfície de mercado (home/coleções) |
| catalog | skeleton | Produtos + categorias |
| orders | skeleton | Pedidos / carrinho |
| payments | skeleton | PaySuite rails |
| wallet | skeleton | Ledger independente (ainda sem implementação) |
| billing | skeleton | Consumo + premium (ainda sem implementação) |

Módulos a nascer sob procura: `pricing`, `media`, `feature-flags`,
`subscriptions`, `discovery/search`, `commerce-orchestrator`.

Cada pasta `services/<name>` começa com contrato + health.
A lógica continua no monólito até o domínio ser estrangulado.
