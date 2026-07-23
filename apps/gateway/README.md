# API Gateway (strangler)

Ponto de entrada único. Fases 3–32: routing por prefixo quando
`STRANGLER_ROUTING=1` e as URLs dos serviços estão definidas.

## Rotas

| Prefixo | Env | Default port | Serviço |
|---|---|---|---|
| `/api/auth/*` | `IDENTITY_URL` | 4107 | identity (owned; Google OAuth included) |
| `/api/affiliate/*` | `AFFILIATES_URL` | 4108 | affiliates (owned) |
| `/api/accounts/*`, `/api/addresses/*` | `ACCOUNTS_URL` | 4109 | accounts (owned) |
| `/api/shops/*`, `/api/ads/*`, `/api/wishlist/*` | `MARKETPLACE_URL` | 4111 | marketplace (owned) |
| `/api/categories/*`, `/api/products/*`, `/api/seller/*`, `/api/admin/products` | `CATALOG_URL` | 4110 | catalog (owned) |
| `/api/commerce/*` | `ORCHESTRATOR_URL` | 4100 | commerce-orchestrator |
| `/api/orders/*`, `/api/cart/*` | `ORDERS_URL` | 4101 | orders (incl. settle-paid internal) |
| `/api/billing/paysuite/*`, `/stripe/*`, `/mpesa/*` | `PAYMENTS_URL` | 4102 | payments |
| `/api/wallet/*` | `WALLET_URL` | 4103 | wallet |
| `/api/pricing/*`, `/api/subscriptions/*`, `/api/billing/*` | `BILLING_URL` | 4104 | billing (paysuite/stripe/mpesa → payments) |
| `/api/media/*`, `/api/uploads/*` | `MEDIA_URL` | 4105 | media |
| `/api/developers/*`, `/api/v1/*`, `/api/feature-flags/*` | `DEVELOPERS_URL` | 4106 | developers |
| `/api/logistics/*` | `LOGISTICS_URL` | 4112 | logistics |
| `/api/accounting/*` | `ACCOUNTING_URL` | 4113 | accounting |
| `/api/notifications/*`, `/api/conversations/*`, `/api/disputes/*` | `COMMS_URL` | 4114 | comms |
| `/api/coupons/*` | `COUPONS_URL` | 4115 | coupons |
| `/api/inventory/*` | `INVENTORY_URL` | 4116 | inventory |
| `/api/dashboard/*`, `/api/store/settings`, `/api/platform/settings` | `PLATFORM_SETTINGS_URL` | 4118 | platform-settings |
| `/api/users/*`, `/api/reliability/*`, `/api/cron/*` | `PLATFORM_OPS_URL` | 4119 | platform-ops |
| `/api/security/*` | `PLATFORM_SECURITY_URL` | 4120 | platform-security |
| resto | `UPSTREAM_API_URL` | 4000 | monólito |

Sem `STRANGLER_ROUTING=1`, **tudo** vai para o monólito.

## Cookie SSO (Fase 6)

Definir `COOKIE_DOMAIN` no monólito (ex. `.ishopine.com`) e
`NEXT_PUBLIC_COOKIE_SSO=1` nos frontends. Login grava `ishopine_session`
HttpOnly; apps usam `credentials: "include"`.
