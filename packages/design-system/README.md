# @ishopine/design-system

Shopify Polaris-inspired tokens for iShopine (Mozambique commerce).

## Usage

```css
@import "@ishopine/design-system/tokens.css";
```

```ts
import { colors, space, radius } from "@ishopine/design-system";
```

```ts
// tailwind.config.ts
import preset from "@ishopine/design-system/tailwind-preset";
export default { presets: [preset], content: [...] };
```

## Layout (matches Admin screenshots)

- Dark **top bar** `#1A1A1A`
- Light **sidebar** `#F1F1F1` with white active item
- Page **background** `#F6F6F7`, **cards** white, radius 8px
- Primary CTA **Brand Green** `#008060`
