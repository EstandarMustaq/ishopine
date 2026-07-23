# Fase 26 — Remote checkout E2E + addresses + accounting post

## Objectivo

1. **E2E real** do carrinho → checkout com as 3 flags remotas da Fase 25
2. **Ownership** adicional: addresses (`accounts`) + accounting revenue remota
3. **Correios**: continua **indisponível** (sem OpenAPI/contrato) — env de
   contrato documentado, **sem** cliente HTTP inventado

## Entregue

### E2E
- `scripts/e2e-phase26-checkout.cjs`
- `pnpm e2e:phase26` (sobe stranglers com flags remotas e corre o script)

Fluxo: login comprador → address → cart → cupão → checkout orders →
RESERVE → CONFIRMED (OUT + accounting) → SHIPPED (label) →
partners Correios `unavailable`.

### Addresses (`ACCOUNTS_OWNED`, :4109)
- `GET|POST /api/addresses` no serviço accounts
- Gateway: `/api/addresses` → `ACCOUNTS_URL`

### Accounting internal
- `POST /api/accounting/internal/record-order-revenue`
- Orders: `ACCOUNTING_POST_REMOTE≠0` + `ACCOUNTING_URL`

### Correios (honest)
- Partners reporta `mode: unavailable`, `configured: false`
- Env opcional: `CORREIOS_MZ_CONTRACTED`, `CORREIOS_MZ_API_BASE`,
  `CORREIOS_MZ_API_KEY`, `CORREIOS_MZ_API_SECRET`
- Mesmo com credenciais: **sem** adapter HTTP até haver contrato/OpenAPI

## Env (E2E)

```bash
JWT_SECRET=...
INTERNAL_SERVICE_SECRET=...
ORDERS_URL=http://127.0.0.1:4101
COUPONS_URL=http://127.0.0.1:4115
COUPON_REDEEM_REMOTE=1
INVENTORY_URL=http://127.0.0.1:4116
INVENTORY_RESERVE_REMOTE=1
LOGISTICS_URL=http://127.0.0.1:4112
LOGISTICS_LABEL_REMOTE=1
ACCOUNTING_URL=http://127.0.0.1:4113
ACCOUNTING_POST_REMOTE=1
ACCOUNTS_URL=http://127.0.0.1:4109
```

## Fora de âmbito
- Cliente HTTP Correios inventado
- Extrair dashboard → **Fase 27** ([PHASE27.md](./PHASE27.md))
- Users admin / reliability
