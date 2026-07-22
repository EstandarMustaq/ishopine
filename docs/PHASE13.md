# Fase 13 — Identity extract (auth owned)

## Objectivo

Extrair **IAM local** (`/api/auth`) para `services/identity` (`IDENTITY_OWNED`)
com parity Nest: register/login/2FA/session + cookie SSO — sem teatro de
carriers HTTP nem multi-PoP CDN.

## Entregue

### Identity owned (`IDENTITY_OWNED≠0`, :4107)
- Register / verify-email / resend-code / login / verify-2fa / logout
- 2FA setup / enable / disable (JWT)
- `GET /me` + `GET /session` (SSO bootstrap)
- Cookie `ishopine_session` (HttpOnly, SameSite=Lax, Domain opcional)
- Throttle in-memory alinhado ao Nest (5–10/min)
- SMTP via `SMTP_*` (devCode quando SMTP ausente fora de prod)

### Fallthrough Nest
- `GET /api/auth/google*` — Passport OAuth + redirects (sem reimplementar)

### Gateway
- Prefixo `/api/auth` → `IDENTITY_URL` (já existente com `STRANGLER_ROUTING=1`)

## Env

```bash
IDENTITY_OWNED=1
IDENTITY_URL=http://127.0.0.1:4107
UPSTREAM_API_URL=http://127.0.0.1:4000
JWT_SECRET=...
JWT_EXPIRES_IN=7d
DATABASE_URL=...
# COOKIE_DOMAIN=.ishopine.com
# AUTH_COOKIE_NAME=ishopine_session
# SMTP_HOST / SMTP_USER / SMTP_PASS / SMTP_FROM
```

## Fora de âmbito
- Clientes HTTP Correios/DHL (sem API pública útil)
- Multi-região CDN / PoPs
- Extrair Google OAuth para identity (fica Nest até Passport edge)
- Affiliate / subscription extract
