# Fase 10 — Checkout owned + wallet settle idempotente

## Objectivo

Extrair **`POST /api/orders/checkout`** para o serviço orders e o **settle de
payout** para o wallet owned — com idempotência real, sem mocks de carriers.

PaySuite continua no Nest; orchestrator compõe checkout + pagamento.

## Entregue

### Orders owned checkout
- `POST /api/orders/checkout` com parity Nest (stock, fees, cupão, shipments)
- Cotação via Nest `POST /api/logistics/quote` (adapters/zonas = fonte única)
- `Idempotency-Key` → `IdempotencyRecord` scope `orders:checkout`
- Outbox `order.created`
- Cart / status (Fase 9) + checkout (Fase 10)

### Wallet owned settle
- `POST /api/wallet/internal/settle-order`
- Auth: `Authorization: Bearer <INTERNAL_SERVICE_SECRET|CRON_SECRET>`
- Idempotente: se já existe `CREDIT` com `reference=orderId` → `alreadySettled`
- Outbox `wallet.credited`
- Nest `settlePaidOrders` chama settle remoto quando `WALLET_URL` + secret
  (`WALLET_SETTLE_REMOTE≠0`); fallback in-process

### Nest harden
- `WalletService.settleOrderPayout` também idempotente por `reference`

## Env

```bash
ORDERS_OWNED=1
WALLET_OWNED=1
WALLET_URL=http://127.0.0.1:4103
WALLET_SETTLE_REMOTE=1
INTERNAL_SERVICE_SECRET=...   # ou CRON_SECRET
UPSTREAM_API_URL=http://127.0.0.1:4000   # logistics quote
```

## Fora de âmbito
- Extrair cliente PaySuite para `services/payments`
- Clientes HTTP Correios/DHL
- CDN multi-região / PoPs
- Affiliate/subscription extract (continuam Nest após pagamento)
