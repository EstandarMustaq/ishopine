# payments (strangler)

Porta **4102**. Prefixo `/api/billing/paysuite`.

## Owned (`PAYMENTS_OWNED≠0`, default)

| Método | Path | Auth |
|---|---|---|
| POST | `/checkout` | JWT + `Idempotency-Key` |
| GET | `/status/:paymentId` | JWT |
| POST | `/webhook` | HMAC PaySuite |
| POST | `/payouts` | JWT admin + 2FA |
| POST | `/refunds` | JWT admin + 2FA |

On `payment.success` / PAID → Nest `POST /api/orders/internal/settle-paid`.

## Proxy

`PAYMENTS_OWNED=0` → tudo para `UPSTREAM_API_URL`.
