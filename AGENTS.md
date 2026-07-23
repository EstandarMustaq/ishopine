# iShopine — agent notes

- Product: **iShopine** (`ishopine.com`) — marketplace for Mozambique (MZN). Not operated by Nkateko.
- Packages: `@ishopine/api` (NestJS), `@ishopine/marketplace-web` (Next.js on Vercel).
- Payments: **PaySuite** — `PAYSUITE_ENABLED=0` until merchant quota; live needs token + webhook secret.
- Env checklist: `docs/ENV.md`. Production status: `docs/DEPLOY_PRODUCTION.md`.
- Deploy: marketplace → Vercel `ishopine` (`apps/marketplace-web`) → https://ishopine.vercel.app  
  API → Vercel `ishopine-api` (`apps/api`) → https://ishopine-api.vercel.app  
  Set `NEXT_PUBLIC_API_URL=https://ishopine-api.vercel.app`. DB: Neon. Cron: `/api/cron/outbox` + `CRON_SECRET`.
