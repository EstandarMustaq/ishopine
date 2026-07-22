# Identity (owned — Fase 13)

Porta **4107**. Com `IDENTITY_OWNED≠0` (default) trata auth local + 2FA +
sessão SSO; Google OAuth continua no Nest via fallthrough.

## Rotas owned

| Método | Path | Notas |
|---|---|---|
| POST | `/api/auth/register` | throttle 5/min |
| POST | `/api/auth/verify-email` | cookie SSO |
| POST | `/api/auth/resend-code` | |
| POST | `/api/auth/login` | cookie SSO |
| POST | `/api/auth/verify-2fa` | cookie SSO |
| POST | `/api/auth/logout` | clear cookie |
| POST | `/api/auth/2fa/setup\|enable\|disable` | JWT |
| GET | `/api/auth/me` | JWT |
| GET | `/api/auth/session` | JWT / SSO probe |

## Fallthrough Nest

- `GET /api/auth/google*` — Passport OAuth

```bash
IDENTITY_OWNED=1
IDENTITY_URL=http://127.0.0.1:4107
JWT_SECRET=...
DATABASE_URL=...
# COOKIE_DOMAIN=.ishopine.com
pnpm --filter @ishopine/identity dev
```
