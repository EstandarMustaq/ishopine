# Fase 0 — entregue (fundação)

## Plano fechado

Ver [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md).

Alterações estratégicas incorporadas:

- Account pode ter **1 PARTICULAR + N STORE**
- Backoffice = só equipa iShopine (ops/métricas)
- Microserviços via **strangler** (não 15 serviços no dia 1)
- Wallet/Billing como plataformas reutilizáveis (esqueleto)
- Pricing / Media / Feature Flags / Orchestrator previstos

## Neste PR

1. **Prisma:** `Account`, `Tenant`, `TenantMembership`, `PlatformStaff`
2. **API:** `GET/POST /api/accounts/*` + `TenantGuard` (`x-tenant-id`)
3. **Gateway:** `apps/gateway` proxy strangler → monólito
4. **Skeletons:** `services/{identity,accounts,marketplace,catalog,orders,payments,wallet,billing}`
5. **Shared:** `packages/shared` contratos tenant
6. **Seed:** vendedor1 com PARTICULAR + STORE; admin/operador como PlatformStaff

## Próximo

Ver [`docs/PHASE1.md`](./PHASE1.md) (entregue).
