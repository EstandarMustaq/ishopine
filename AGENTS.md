# iShopine — agent notes

- Marketplace product: **iShopine** (`ishopine.com`), operated by **Nkateko Investment and Service**.
- Monorepo packages: `@ishopine/api` (NestJS), `@ishopine/web` (Next.js).
- Local DB: Postgres. Prefer `apps/api/.env` `DATABASE_URL`. Use `pnpm db:push` then `pnpm db:seed` (avoid `--force-reset` without explicit user consent).
- Demo password: `IShopine@2026` — accounts `admin@ishopine.com`, `operador@ishopine.com`, `vendedor1@ishopine.com`, `vendedor2@ishopine.com`, `comprador@ishopine.com`.
- Billing: Stripe Checkout + Vodacom M-Pesa MZ C2B are **parallel** providers (`BillingModule`). M-Pesa is not a Stripe payment method. Without keys, API simulates success.
- Health: `GET /api/health`. E2E: `pnpm --filter @ishopine/api test:e2e`.
