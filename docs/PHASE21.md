# Fase 21 — Accounting extract (ledger owned)

## Objectivo

Extrair a superfície Nest de **accounting** para `services/accounting`
(`ACCOUNTING_OWNED`) com parity de roles + 2FA.
Live carriers e multi-PoP CDN continuam bloqueados (sem APIs/infra reais).

## Entregue

### Accounting owned (`ACCOUNTING_OWNED≠0`, :4113)
- Plano de contas: list / create
- Lançamentos: list (filtros), create draft/posted, post, void
- `GET /summary` (totais POSTED + net income)
- Auth: `PLATFORM_ADMIN` / `PLATFORM_OPERATOR` + TwoFactorGuard parity

### Gateway
- `/api/accounting` → `ACCOUNTING_URL`

### Nest
- Dashboard aggregates e restantes módulos (notifications, disputes, …)
  permanecem no monólito

## Env

```bash
ACCOUNTING_OWNED=1
ACCOUNTING_URL=http://127.0.0.1:4113
UPSTREAM_API_URL=http://127.0.0.1:4000
JWT_SECRET=...
DATABASE_URL=...
```

## Fora de âmbito
- Clientes HTTP Correios / DHL
- Multi-região CDN / PoPs
- Extrair notifications / messages / disputes → **Fase 22** ([PHASE22.md](./PHASE22.md))
- Coupons / inventory / reviews → **Fase 24** ([PHASE24.md](./PHASE24.md))
