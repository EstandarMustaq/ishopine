# Accounts (owned — Fase 16)

Porta **4109**. Com `ACCOUNTS_OWNED≠0` (default) trata Account + tenants
(PARTICULAR / STORE). Nest `TenantGuard` / `AccountsService` continuam
in-process para authz noutros módulos.

## Rotas owned

| Método | Path | Auth |
|---|---|---|
| GET | `/api/accounts/me` | JWT |
| POST | `/api/accounts/tenants/particular` | JWT |
| POST | `/api/accounts/tenants/store` | JWT |
| GET | `/api/accounts/tenants/active` | JWT + `x-tenant-id` opcional |

```bash
ACCOUNTS_OWNED=1
ACCOUNTS_URL=http://127.0.0.1:4109
pnpm --filter @ishopine/accounts dev
```
