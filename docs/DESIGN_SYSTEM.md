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

## Layout

- Sidebar 240px; top bar 56px; content max 1200px
- Touch targets ≥44×44px
