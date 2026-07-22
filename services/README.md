# Services — extracção gradual (strangler)

| Serviço | Estado | Notas |
|---|---|---|
| **identity** | **owned :4107** | Auth local + 2FA + session (`IDENTITY_OWNED`); Google → Nest |
| **accounts** | **owned :4109** | Account + tenants PARTICULAR/STORE (`ACCOUNTS_OWNED`) |
| **marketplace** | **owned :4111** | Shops + ads + wishlist (`MARKETPLACE_OWNED`) |
| **catalog** | **owned :4110** | Categorias + produtos híbridos (`CATALOG_OWNED`) |
| **orders** | **owned :4101** | Cart + GET + status + checkout (`ORDERS_OWNED`) |
| **payments** | **owned :4102** | PaySuite checkout/status/webhook/**payouts/refunds** |
| commerce-orchestrator | compose :4100 | Saga: orders checkout → PaySuite |
| **wallet** | **owned :4103** | Reads + internal settle (`WALLET_OWNED`) |
| **billing** | **owned :4104** | Pricing + subscriptions + usage (`BILLING_OWNED`); PaySuite → payments |
| **media** | **owned :4105** | Upload/list/delete + **static /uploads** cache |
| **developers** | **owned :4106** | API keys + v1 + feature-flags (`DEVELOPERS_OWNED`); fan-out Nest |
| **affiliates** | **owned :4108** | Links/clicks/rewards + internal conversion (`AFFILIATES_OWNED`) |
| **logistics** | **owned :4112** | Zones + shipments + HMAC webhooks (`LOGISTICS_OWNED`) |

Helper: `@ishopine/shared` → `startStranglerProxy`.
