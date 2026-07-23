# Accounting (owned — Fase 21)

Porta **4113**. Com `ACCOUNTING_OWNED≠0` (default) trata plano de contas,
lançamentos (draft/post/void) e summary — staff backoffice.

## Rotas owned

| Método | Path | Roles |
|---|---|---|
| GET | `/api/accounting/accounts` | ADMIN, OPERATOR |
| POST | `/api/accounting/accounts` | ADMIN |
| GET | `/api/accounting/entries` | ADMIN, OPERATOR |
| POST | `/api/accounting/entries` | ADMIN, OPERATOR |
| GET | `/api/accounting/summary` | ADMIN, OPERATOR |
| PATCH | `/api/accounting/entries/:id/post` | ADMIN |
| PATCH | `/api/accounting/entries/:id/void` | ADMIN |

Auth: JWT + Nest `TwoFactorGuard` parity.

```bash
ACCOUNTING_OWNED=1
ACCOUNTING_URL=http://127.0.0.1:4113
pnpm --filter @ishopine/accounting dev
```
