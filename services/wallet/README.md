# Wallet (strangler — owned reads)

Porta **4103**. Com `WALLET_OWNED≠0` (default), trata `GET /api/wallet/me|tenant|ledger`
localmente. Writes (settle) continuam no monólito.

```bash
JWT_SECRET=… DATABASE_URL=… pnpm --filter @ishopine/wallet dev
```
