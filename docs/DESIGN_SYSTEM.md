# Design System — iShopine (Shopify Polaris-inspired)

Forest green anchors commerce trust; neutrals keep merchant data clear.
Implementation: `@ishopine/design-system` + `@ishopine/ui`.

## Atmosphere

- Clean, professional, never flashy
- 8px base grid
- Flat surfaces, minimal shadows (`raised` on cards)
- **No pictorial logo** — brand is the wordmark text **iShopine**

## Colors

| Token | Hex | Role |
|---|---|---|
| Brand Green | `#008060` | Primary CTA, success |
| Dark Green | `#004C3F` | Hover / pressed |
| Interactive Blue | `#0070D9` | Links, info |
| Text Primary | `#202223` | Body / headings |
| Text Secondary | `#6D7175` | Captions |
| Background | `#F6F6F7` | Page |
| Surface | `#FFFFFF` | Cards / top bar |
| Border / Subdued | `#C9CCCF` / `#E4E5E7` | Inputs / dividers |
| Critical | `#D72C0D` | Errors / destructive |
| Top bar | `#FFFFFF` | Global header (56px) |
| Sidebar | `#1A1A1A` | Left nav (dashboards) |

## Typography

`ShopifySans, -apple-system, BlinkMacSystemFont, sans-serif`

| Role | Size | Weight |
|---|---|---|
| Display | 40px | 700 |
| H1 | 28px | 700 |
| H2 | 20px | 600 |
| H3 | 16px | 600 |
| Body | 14px | 400 |
| Caption | 12px | 400 |
| Button | 14px | 500 |

## Components

- Buttons: radius **4px**, primary green / secondary white+border / destructive critical
- Cards: white, 8px radius, subdued border, raised shadow
- Inputs: 4px radius, green focus ring
- State components: use `EmptyState`, `LoadingState`, `ErrorState` and `SuccessBanner` from `@ishopine/ui` for all blank, pending, failed and completed flows. Copy is direct, Portuguese, and action-oriented; no emoji or decorative logo art.

## State patterns

- Empty: title names the missing object, description explains what happens next, one clear action when useful.
- Loading: announce progress with `aria-busy` / `aria-live`; prefer skeletons for lists and spinner for short blocking states.
- Error: state what failed, avoid blame, include a retry or refresh action.
- Success: use green success banners for completed actions; make them dismissible when persistent on page.

## Layout

- Sidebar 240px; top bar 56px; content max 1200px
- Touch targets ≥44×44px

## Surface UX principles

- Marketplace web: open, product-first commerce; white header, green primary actions, objective copy for search, filters and empty results.
- Customer: account tasks first; clear navigation for pedidos, endereços and favoritos, with reassuring empty states that point back to buying.
- Seller dashboard: operational clarity; dark sidebar, white topbar and compact tables/forms for products, orders and store work.
- Affiliate: lightweight progress view; focus on links, clicks and commissions with simple empty states for first-link setup.
- Admin: staff efficiency; dense but readable controls, consistent loading/error states and no brand decoration beyond the iShopine wordmark.


## Magic Patterns

- Design system: https://www.magicpatterns.com/design-system/ds-4571706d-048b-4a65-af2a-3f7929d815b5
- Surface inspiration (Marketplace · Cliente · Particular · Loja · Afiliado · Backoffice): https://www.magicpatterns.com/inspiration/e84925f5-32b0-4df1-8aed-e52dae887aff
