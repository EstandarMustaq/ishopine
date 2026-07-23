# Design System — iShopine (Shopify Polaris-inspired)

Forest green anchors commerce trust; neutrals keep merchant data clear.
Implementation: `@ishopine/design-system` + `@ishopine/ui`.

## Atmosphere

- Clean, professional, never flashy
- 8px base grid, generous but functional whitespace
- Flat surfaces, minimal shadows (`raised` on cards)

## Colors

| Token | Hex | Role |
|---|---|---|
| Brand Green | `#008060` | Primary CTA, success, avatar |
| Dark Green | `#004C3F` | Hover / pressed |
| Interactive Blue | `#0070D9` | Links, info |
| Text Primary | `#202223` | Body / headings |
| Text Secondary | `#6D7175` | Captions |
| Background | `#F6F6F7` | Page |
| Surface | `#FFFFFF` | Cards |
| Border / Subdued | `#C9CCCF` / `#E4E5E7` | Inputs / dividers |
| Critical | `#D72C0D` | Errors / destructive |
| Top bar | `#1A1A1A` | Global header |
| Sidebar | `#F1F1F1` | Left nav (light — matches Admin screenshots) |

> Note: some Polaris docs mention a dark sidebar; **current Shopify Admin**
> (and our reference screenshots) use a **light** sidebar + dark top bar.
> Tokens follow the screenshots.

## Typography

Primary stack: `ShopifySans, -apple-system, BlinkMacSystemFont, sans-serif`
(system fallback until we license/host ShopifySans).

| Role | Size | Weight |
|---|---|---|
| Display | 40px | 700 |
| H1 | 28px | 700 |
| H2 | 20px | 600 |
| H3 | 16px | 600 |
| Body | 14px | 400 |
| Caption | 12px | 400 |
| Button | 14px | 500 |

## Components (`@ishopine/ui`)

- **Button** — primary (green), secondary, destructive, plain, dark
- **Card** — white, 8px radius, subdued border, raised shadow
- **Input** — 4px radius, green focus ring
- **EmptyState** / **PageHeader** — merchant empty canvases
- **AdminShell** — top bar + sidebar + content (mobile overlay)

## Layout

- Sidebar width 240px; top bar 56px; content max 1200px
- Breakpoints: mobile &lt;768, tablet 768–1023, desktop ≥1024
- Touch targets ≥44×44px

## Do / Don't

**Do:** green for positive actions; labels above fields; one-column forms.  
**Don't:** red except errors; decorative fonts; &gt;2 nav nesting levels.

## Usage

```css
@import "@ishopine/design-system/tokens.css";
```

```ts
import preset from "@ishopine/design-system/tailwind-preset";
import { AdminShell, PageHeader, Card, Button } from "@ishopine/ui";
```
