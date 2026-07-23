# iShopine monorepo — app & package map

## Target layout

```
apps/
  marketplace-web   # public marketplace
  seller-dashboard  # particular + STORE tenants
  admin             # iShopine staff backoffice
  customer          # buyer account (may start inside marketplace-web)
  affiliate         # affiliate portal
  api               # Nest edge shell (health + cron → platform-ops)
  mobile            # native / Expo (future)
  gateway           # strangler gateway (runtime; not in marketing tree)

packages/
  ui                # React primitives (Polaris-inspired)
  design-system     # tokens + Tailwind preset
  sdk               # typed API client
  shared            # strangler helpers / shared types
  database          # Prisma home (proxies apps/api/prisma today)
  config            # shared tsconfig
```

## Current → target mapping

| Today | Target | Status |
|---|---|---|
| `apps/web` | `apps/marketplace-web` | alias pending rename |
| `apps/seller` | `apps/seller-dashboard` | tokens wired; rename pending |
| `apps/backoffice` | `apps/admin` | rename pending |
| `apps/affiliate` | `apps/affiliate` | ok |
| `apps/api` | `apps/api` | Nest shell (Phase 40+) |
| — | `apps/customer` | stub |
| — | `apps/mobile` | stub |
| `packages/shared` | `packages/shared` | ok |
| — | `packages/{ui,design-system,sdk,database,config}` | **scaffolded** |

Physical renames are deferred to avoid breaking Vercel project paths; package
names and docs use the target vocabulary.

## Design system

See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) and `@ishopine/design-system`.

Dashboards (seller / admin) use:

- Dark top bar `#1A1A1A`
- Light sidebar `#F1F1F1`
- Page canvas `#F6F6F7`
- Brand green `#008060` for primary / success
