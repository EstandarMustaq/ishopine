# @ishopine/api — Nest edge shell (Phase 40+)

Thin Nest process used as Vercel/local **health + cron proxy** only.

- `GET /api/health`
- `GET|POST /api/cron/outbox` → requires `PLATFORM_OPS_URL` (platform-ops owns outbox)

All domain APIs are owned by strangler services behind the gateway
(`STRANGLER_ROUTING=1`). See [docs/PHASE40PLUS.md](../../docs/PHASE40PLUS.md).

```bash
pnpm --filter @ishopine/api dev
# PLATFORM_OPS_URL=http://127.0.0.1:4119 CRON_SECRET=...
```

Prisma schema for the monorepo remains in `prisma/` (generate for services);
this Nest app does not boot Prisma Client.
