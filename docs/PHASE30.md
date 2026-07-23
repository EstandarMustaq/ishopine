# Fase 30 — Google OAuth owned + settle-paid on orders

## Objectivo

Fechar fallthroughs Nest restantes (sem inventar Correios HTTP):

1. **Google OAuth** → `identity` owns `/api/auth/google*` (OAuth2 contra Google OpenID).
2. **Settle pago** → `orders` owns `POST /api/orders/internal/settle-paid`;
   payments chama `ORDERS_URL` (não Nest).

Correios continua **bloqueado** — OpenAPI ausente em `docs/contracts/`.

## Entregue

### Identity (Google)
- `GET /api/auth/google` → redirect `/start` (ou 503 se env em falta)
- `GET /api/auth/google/start` → Google authorize
- `GET /api/auth/google/callback` → code exchange + login/register + cookie SSO

Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `WEB_URL`, `COOKIE_DOMAIN`

### Orders (settle)
- `POST /api/orders/internal/settle-paid` — Bearer `INTERNAL_SERVICE_SECRET|CRON_SECRET`
- Remotes: affiliates / wallet / billing usage (quando flags + URLs)

### Payments
- Após PaySuite PAID → `ORDERS_URL/api/orders/internal/settle-paid`

### Correios
Sem mudança live — gate Fase 29; checklist `docs/contracts/README.md`.

## Env

```bash
IDENTITY_OWNED=1
IDENTITY_URL=http://127.0.0.1:4107
ORDERS_OWNED=1
ORDERS_URL=http://127.0.0.1:4101
PAYMENTS_OWNED=1
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# GOOGLE_CALLBACK_URL=http://127.0.0.1:4107/api/auth/google/callback
```

## Fora de âmbito
- Cliente HTTP Correios (OpenAPI ausente)
- Legacy stripe/mpesa aliases no Nest billing
- Remover Passport Google do Nest monólito (pode ficar como dead code até cleanup)
