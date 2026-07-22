# Fase 4 — Wallet + Billing (consumo/premium) + Pricing

## Objectivo

Plataforma financeira reutilizável (**Wallet**) e faturação de plataforma
(**Pricing / Subscriptions / Usage**), separada do PaySuite (pagamentos de
pedidos — já em `payments`).

## Entregue

### Prisma
- `Wallet`, `WalletLedgerEntry`
- `PricingPlan`, `Subscription`, `UsageRecord`, `PlatformInvoice`
- Enums: `WalletOwnerType`, `LedgerEntryType`, `PricingPlanCode`, …

### API (monólito)
| Prefixo | Função |
|---|---|
| `/wallet/me`, `/wallet/tenant`, `/wallet/ledger` | Carteiras |
| `/pricing/plans` | Planos FREE/STARTER/BUSINESS/ENTERPRISE (seed auto) |
| `/subscriptions`, `/subscriptions/me` | Subscrever / ver plano |
| `/billing/usage`, `/billing/invoices` | Uso + faturas de plataforma |

No settle de pedido pago:
1. Credita wallet do tenant (líquido) + wallet `platform` (taxa)
2. Regista `UsageMetric.ORDERS`

### Strangler
| Serviço | Porta | Prefixo |
|---|---|---|
| wallet | 4103 | `/api/wallet` |
| billing | 4104 | `/api/pricing`, `/api/subscriptions`, `/api/billing`* |

\* `/api/billing/paysuite` continua no serviço **payments** (match mais específico no gateway).

### UI
- Seller `/carteira` — saldo, planos, movimentos
- Backoffice `/pricing` — tabela de planos

## Gateway

```bash
STRANGLER_ROUTING=1 \
  WALLET_URL=http://127.0.0.1:4103 \
  BILLING_URL=http://127.0.0.1:4104 \
  …
```

## Próximo (Fase 5+)

Ver [`docs/PHASE5.md`](./PHASE5.md).

Histórico: wallet + pricing/subscriptions + billing strangler.
