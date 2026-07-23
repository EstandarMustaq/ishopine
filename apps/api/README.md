# @ishopine/api

## Role (Phase 40+)

- **Nest shell**: `GET /api/health` + cron proxy to `platform-ops` only.
- **Domain logic**: exclusive to `services/*/src/owned.ts` — never re-add Nest domain modules.

## Production composition (cutover)

`apps/platform-api` + `src/compose.ts` dispatch in-process to owned handlers
(composition edge). Required on Vercel because 21 long-running processes are
not available.

Local smoke (with `DATABASE_URL`):

```bash
pnpm --filter @ishopine/shared build
node apps/api/scripts/build-composition.mjs
node -e "require('http').createServer(require('./composition/api.js')).listen(4099)"
curl localhost:4099/api/health   # mode: composition
```

Promote only after preview returns `ownership: "services-exclusive"` and
catalog/auth smoke passes. Until then production stays on the last stable
monolith deploy (rolled back if needed).

See [docs/SERVICES.md](../../docs/SERVICES.md).
