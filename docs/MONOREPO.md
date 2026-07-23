# iShopine monorepo — app & package map

## Target layout

```
apps/
  marketplace-web   # public marketplace (today: apps/web)
  seller-dashboard  # particular + STORE tenants (today: apps/seller)
  admin             # iShopine staff backoffice (today: apps/backoffice)
  customer          # buyer account — pedidos, endereços, favoritos
  affiliate         # affiliate portal
  api               # Nest edge shell (health + cron → platform-ops)
  mobile            # mobile web / PWA-ready (Expo native later)
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
| `apps/web` | `apps/marketplace-web` | Brand Green + tokens; rename pending |
| `apps/seller` | `apps/seller-dashboard` | Polaris chrome; rename pending |
| `apps/backoffice` | `apps/admin` | Polaris chrome + observability; rename pending |
| `apps/affiliate` | `apps/affiliate` | Brand Green aliases |
| `apps/customer` | `apps/customer` | **live** (port 3004) |
| `apps/mobile` | `apps/mobile` | **live** mobile web / PWA (port 3005) |
| `apps/api` | `apps/api` | Nest shell (Phase 40+) |
| `packages/shared` | `packages/shared` | ok |
| `packages/{ui,design-system,sdk,database,config}` | same | **ready for V2** |

Physical renames are deferred to avoid breaking Vercel project paths; package
names and docs use the target vocabulary.

## Design system

See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) and `@ishopine/design-system`.

Dashboards (seller / admin / affiliate / customer) use:

- Dark top bar `#1A1A1A`
- Light sidebar `#F1F1F1` (where applicable)
- Page canvas `#F6F6F7`
- Brand green `#008060` for primary / success

## Launch

See [LAUNCH.md](./LAUNCH.md) for ports, auth handoff, and deploy notes.
