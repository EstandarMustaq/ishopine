# wallet (strangler)

Porta **4103**. Prefixo `/api/wallet`.

## Owned (`WALLET_OWNED≠0`)

| Método | Path | Auth |
|---|---|---|
| GET | `/me`, `/tenant`, `/ledger` | JWT (+ membership no tenant) |
| POST | `/internal/settle-order` | Bearer `INTERNAL_SERVICE_SECRET` ou `CRON_SECRET` |

Settle é **idempotente** por `reference=orderId` (CREDIT).

Nest chama settle remoto quando `WALLET_URL` + secret e `WALLET_SETTLE_REMOTE≠0`.
