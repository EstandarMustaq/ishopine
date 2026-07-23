# Platform security (owned — Fase 29)

Porta **4120**. Com `PLATFORM_SECURITY_OWNED≠0` (default):

| Método | Path | Auth |
|---|---|---|
| GET | `/api/security/compliance` | ADMIN (+ 2FA) |
| GET | `/api/security/findings` | ADMIN (+ 2FA) |
| POST | `/api/security/sync` | ADMIN (+ 2FA) |
| POST | `/api/security/findings/:id/acknowledge` | ADMIN (+ 2FA) |

```bash
PLATFORM_SECURITY_OWNED=1
PLATFORM_SECURITY_URL=http://127.0.0.1:4120
pnpm --filter @ishopine/platform-security dev
```

Correios continua indisponível até OpenAPI/contrato em `docs/contracts/`.
