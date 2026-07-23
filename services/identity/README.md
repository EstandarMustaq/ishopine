# Identity (owned — Fase 13–30)

Porta **4107**. Com `IDENTITY_OWNED≠0` (default) trata auth local + 2FA +
sessão SSO + **Google OAuth** (OpenID).

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
| GET | `/api/auth/google` | redirect → start (ou 503) |
| GET | `/api/auth/google/start` | Google authorize |
| GET | `/api/auth/google/callback` | code exchange + cookie |

```bash
IDENTITY_OWNED=1
IDENTITY_URL=http://127.0.0.1:4107
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://127.0.0.1:4107/api/auth/google/callback
JWT_SECRET=...
DATABASE_URL=...
# COOKIE_DOMAIN=.ishopine.com
pnpm --filter @ishopine/identity dev
```
