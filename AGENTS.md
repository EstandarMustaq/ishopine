# AGENTS.md

Mavula Móveis — furniture e-commerce monorepo (pnpm workspace).

- `apps/api` — NestJS 11 REST API + Prisma 6 (PostgreSQL).
- `apps/web` — Next.js 15 storefront + operator/admin dashboard.

Standard commands live in the root `README.md` and `package.json` scripts. See those first.

## Cursor Cloud specific instructions

### Database (must be started each session)
- PostgreSQL 16 is installed via apt but is **not** started automatically on boot. Start it before running the API, tests, or db scripts:
  `sudo pg_ctlcluster 16 main start` (or `sudo service postgresql start`).
- Local dev uses a database `mavula` with role `postgres`/`postgres`. `apps/api/.env` already points `DATABASE_URL` to `postgresql://postgres:postgres@localhost:5432/mavula?schema=public` (the repo's `.env.example`/`.env.placeholder` point at an external Neon instance — not used for local dev).
- `apps/api/.env` and `apps/web/.env.local` are git-ignored. If they are missing after a fresh clone, recreate them (API needs `DATABASE_URL`, `JWT_SECRET`, `API_PORT=4000`; web needs `NEXT_PUBLIC_API_URL=http://localhost:4000`).
- On a fresh/empty database, apply schema and seed demo data: `pnpm db:push` then `pnpm db:seed`. Seed accounts (all password `mavula123`): `admin@mavula.com.br`, `operador@mavula.com.br`, `cliente@mavula.com.br`.

### Running / testing
- API: `pnpm dev:api` → serves on `http://localhost:4000` with global prefix `/api` (health: `/api/health`). Note the catalog controller has an empty base path, so products are at `/api/products` (not `/api/catalog/products`).
- Web: `pnpm dev:web` → `http://localhost:3000`.
- API e2e test hits `/api/health` and needs the DB running: `pnpm --filter @mavula/api test:e2e`. There are no unit `*.spec.ts` files, so `pnpm --filter @mavula/api test` reports "no tests found".
- `pnpm --filter @mavula/api lint` runs `eslint --fix` (it rewrites files) and currently reports 3 pre-existing errors unrelated to setup. `pnpm --filter @mavula/web lint` passes clean.

### Known issue (pre-existing, not an env problem)
- `apps/web` fails to compile: `src/app/globals.css` imports `tw-animate-css` (a Tailwind **v4** library) while the project pins Tailwind **v3.4**, producing invalid CSS `var(--spacing(4))` and a 500 on every page. This is a code/dependency incompatibility in the committed source, not a local-setup issue.
