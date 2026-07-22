# Fase 11 — PaySuite extract (payments owned)

## Objectivo

Extrair **checkout / status / webhook PaySuite** para `services/payments`
(`PAYMENTS_OWNED`) — cliente HTTP real + HMAC, sem mocks de carriers/CDN.

Settle pós-pagamento continua no Nest (`settlePaidOrders`: affiliates + wallet + usage).

## Entregue

### Payments owned (`PAYMENTS_OWNED≠0`, :4102)
- `POST /api/billing/paysuite/checkout` (+ `Idempotency-Key` scope `billing:paysuite:checkout`)
- `GET /api/billing/paysuite/status/:paymentId`
- `POST /api/billing/paysuite/webhook` (HMAC `x-webhook-signature`, inbox dedupe)
- Cliente PaySuite movido para `services/payments/src/paysuite/`
- Simulação só fora de produção (`PAYSUITE_SIMULATE` / sem token)
- Payouts/refunds → Nest (proxy fallthrough)

### Nest settle callback
- `POST /api/orders/internal/settle-paid`  
  Auth: Bearer `INTERNAL_SERVICE_SECRET` | `CRON_SECRET`  
  → `OrdersService.settlePaidOrders`
- Payments on PAID chama Nest settle (não wallet directo)

## Env

```bash
PAYMENTS_OWNED=1
PAYMENTS_URL=http://127.0.0.1:4102
UPSTREAM_API_URL=http://127.0.0.1:4000
PAYSUITE_TOKEN=...
PAYSUITE_WEBHOOK_SECRET=...
PAYSUITE_BASE_URL=https://paysuite.tech/api/v1
INTERNAL_SERVICE_SECRET=...
# APP_URL / API_PUBLIC_URL — callback webhook público
```

## Fora de âmbito
- Clientes HTTP Correios/DHL
- CDN multi-região / PoPs
- Extrair payouts/refunds admin
- Affiliate/subscription extract
