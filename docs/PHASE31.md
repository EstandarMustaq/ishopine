# Fase 31 — Nest cleanup (legacy billing + Google Passport)

## Objectivo

Limpeza Nest sem inventar Correios HTTP (OpenAPI ainda ausente):

1. **Legacy billing aliases** → `payments` owns stripe/mpesa → PaySuite.
2. **Remover Google Passport** do Nest (identity already owns OAuth since Fase 30).

## Entregue

### Payments (`:4102`)
| Método | Path | Maps to |
|---|---|---|
| POST | `/api/billing/stripe/checkout` | PaySuite `credit_card` |
| POST | `/api/billing/mpesa/c2b` | PaySuite `mpesa` |
| GET | `/api/billing/mpesa/status/:paymentId` | PaySuite status sync |

Gateway: `/api/billing/stripe`, `/api/billing/mpesa` → `PAYMENTS_URL` (before `/api/billing`).

### Nest cleanup
- Deleted `apps/api/src/auth/google.strategy.ts`
- Removed Google routes / `loginOrRegisterGoogle` / `passport-google-oauth20`
- Removed Nest `billing` stripe/mpesa handlers (dead after payments owns them)
- Kept Nest JWT Passport (`JwtStrategy`)

### Correios
Sem mudança live — gate Fase 29; `docs/contracts/` sem OpenAPI.

## Env

```bash
PAYMENTS_OWNED=1
PAYMENTS_URL=http://127.0.0.1:4102
IDENTITY_URL=http://127.0.0.1:4107
GOOGLE_CALLBACK_URL=http://127.0.0.1:4107/api/auth/google/callback
```

## Fora de âmbito
- Cliente HTTP Correios
- Extrair Nest Mail (sem HTTP)
- Apagar Nest Auth/Billing modules inteiros
- Remover Nest PaySuite HTTP + settle-paid → **Fase 32**
