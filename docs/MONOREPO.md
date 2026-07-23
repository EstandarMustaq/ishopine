# iShopine monorepo — app & package map

## Layout (current)

```
apps/
  marketplace-web   # public marketplace (@ishopine/marketplace-web · :3000)
  seller-dashboard  # particular + STORE tenants (@ishopine/seller-dashboard · :3001)
  admin             # iShopine staff (@ishopine/admin · :3002)
  customer          # buyer account (:3004)
  affiliate         # affiliate portal (:3003)
  api               # Nest edge shell
  mobile            # mobile web / PWA (:3005)
  gateway           # strangler gateway

packages/
  ui
  design-system
  sdk
  shared
  database
  config
```

## Design system

See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md).

- Brand green `#008060`
- Dark top bar `#1A1A1A`
- Light sidebar `#F1F1F1`
- Page canvas `#F6F6F7`

## Launch

See [LAUNCH.md](./LAUNCH.md) and [DEPLOY_PRODUCTION.md](./DEPLOY_PRODUCTION.md).
