# payments (strangler)

Porta **4102**. Prefixo `/api/billing/paysuite` + legacy `/stripe` · `/mpesa`.

## Owned (`PAYMENTS_OWNED≠0`, default)

| Método | Path | Auth |
|---|---|---|
| POST | `/paysuite/checkout` | JWT + `Idempotency-Key` |
| GET | `/paysuite/status/:paymentId` | JWT |
| POST | `/paysuite/webhook` | HMAC PaySuite |
| POST | `/paysuite/payouts` | JWT admin + 2FA |
| POST | `/paysuite/refunds` | JWT admin + 2FA |
| POST | `/stripe/checkout` | JWT → PaySuite `credit_card` (Fase 31) |
| POST | `/mpesa/c2b` | JWT → PaySuite `mpesa` (Fase 31) |
| GET | `/mpesa/status/:paymentId` | JWT (Fase 31) |

On `payment.success` / PAID → `ORDERS_URL` `POST /api/orders/internal/settle-paid`.

## Proxy

`PAYMENTS_OWNED=0` → tudo para `UPSTREAM_API_URL`.
