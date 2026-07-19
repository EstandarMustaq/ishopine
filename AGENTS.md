# iShopine — agent notes

- Product: **iShopine** (`ishopine.com`) — marketplace for Mozambique (MZN). Not operated by Nkateko.
- Packages: `@ishopine/api` (NestJS), `@ishopine/web` (Next.js on Vercel).
- Payments: **PaySuite** (`apps/api/src/billing/paysuite/`). Methods: `mpesa`, `emola`, `credit_card`.
- Reliability (rigid): inbox `(source,messageKey)`, outbox poll 750ms, `Idempotency-Key`, read projections — see `apps/api/src/reliability/rules.ts`.
- Security sync: `POST /api/security/sync` — catalog LOW/MEDIUM/HIGH/CRITICAL — `apps/api/src/security/rules.ts`.
- PaySuite has **no sandbox** — `PAYSUITE_SIMULATE=true` only locally. Prod needs `PAYSUITE_TOKEN` + `PAYSUITE_WEBHOOK_SECRET`.
- Demo: `IShopine@2026` / `admin@ishopine.com`.
- Deploy web: Vercel root → `apps/web`. API stays Nest (separate host); set `NEXT_PUBLIC_API_URL`.
