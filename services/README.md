# Services — extracção gradual (strangler)

| Serviço | Estado | Notas |
|---|---|---|
| **identity** | **owned :4107** | Auth local + 2FA + session + **Google OAuth** (`IDENTITY_OWNED`) |
| **accounts** | **owned :4109** | Account + tenants + **addresses** (`ACCOUNTS_OWNED`) |
| **marketplace** | **owned :4111** | Shops + ads + wishlist (`MARKETPLACE_OWNED`) |
| **catalog** | **owned :4110** | Categorias + produtos híbridos (`CATALOG_OWNED`) |
| **orders** | **owned :4101** | Cart + GET + status + checkout + **settle-paid internal**; remote coupon/inventory/label/accounting/wallet/affiliates |
| **payments** | **owned :4102** | PaySuite checkout/status/webhook/**payouts/refunds** |
| commerce-orchestrator | compose :4100 | Saga: **ORDERS_URL** → **PAYMENTS_URL** (Fase 25) |
| **wallet** | **owned :4103** | Reads + internal settle (`WALLET_OWNED`) |
| **billing** | **owned :4104** | Pricing + subscriptions + usage (`BILLING_OWNED`); PaySuite → payments |
| **media** | **owned :4105** | Upload/list/delete + **static /uploads** + **CDN status** (`MEDIA_CDN_HOST`) |
| **developers** | **owned :4106** | API keys + v1 + feature-flags (`DEVELOPERS_OWNED`); fan-out Nest |
| **affiliates** | **owned :4108** | Links/clicks/rewards + internal conversion (`AFFILIATES_OWNED`) |
| **logistics** | **owned :4112** | Zones + shipments + HMAC + **DHL live fail-closed** (`LOGISTICS_OWNED`) |
| **accounting** | **owned :4113** | Plano de contas + lançamentos + **order revenue internal** |
| **comms** | **owned :4114** | Notifications + conversations + disputes (`COMMS_OWNED`) |
| **coupons** | **owned :4115** | List/create/validate (`COUPONS_OWNED`); redemption → orders |
| **inventory** | **owned :4116** | Movements / low-stock / adjust (`INVENTORY_OWNED`); reserve → orders |
| **reviews** | **owned :4117** | Product reviews (`REVIEWS_OWNED`); gateway `pathRe` before catalog |
| **platform-settings** | **owned :4118** | Dashboard overview/charts + store/platform settings |
| **platform-ops** | **owned :4119** | Users admin + reliability health/sync + cron outbox |
| **platform-security** | **owned :4120** | Compliance / findings / security sync |

Helper: `@ishopine/shared` → `startStranglerProxy`.

E2E Fase 26: `pnpm e2e:phase26` (`scripts/e2e-phase26-checkout.cjs`).
