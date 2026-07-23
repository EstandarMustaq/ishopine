/**
 * iShopine design tokens — Shopify Polaris-inspired.
 * Forest green anchors commerce; neutrals keep merchant data clear.
 */
export const colors = {
  brand: {
    green: "#008060",
    greenDark: "#004C3F",
  },
  interactive: {
    blue: "#0070D9",
  },
  text: {
    primary: "#202223",
    secondary: "#6D7175",
    disabled: "#8C9196",
  },
  surface: {
    background: "#F6F6F7",
    surface: "#FFFFFF",
    border: "#C9CCCF",
    borderSubdued: "#E4E5E7",
  },
  nav: {
    topBar: "#1A1A1A",
    sidebar: "#F1F1F1",
    sidebarActive: "#FFFFFF",
  },
  semantic: {
    success: "#008060",
    warning: "#FFC453",
    critical: "#D72C0D",
    highlight: "#EAF4FB",
  },
} as const;

export const typography = {
  fontFamily: {
    sans: [
      "ShopifySans",
      "-apple-system",
      "BlinkMacSystemFont",
      "Segoe UI",
      "sans-serif",
    ],
    code: ["Menlo", "Monaco", "Consolas", "monospace"],
  },
  size: {
    display: "40px",
    h1: "28px",
    h2: "20px",
    h3: "16px",
    body: "14px",
    caption: "12px",
    button: "14px",
    code: "13px",
  },
} as const;

export const radius = {
  none: "0px",
  sm: "4px",
  md: "8px",
  lg: "12px",
  full: "9999px",
} as const;

export const space = {
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
} as const;

export const elevation = {
  flat: "none",
  raised: "0 1px 0 rgba(22,29,37,0.05)",
  overlay: "0 4px 8px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)",
  modal: "0 8px 24px rgba(0,0,0,0.15)",
} as const;

export const breakpoints = {
  mobile: "0px",
  tablet: "768px",
  desktop: "1024px",
} as const;

export const layout = {
  sidebarWidth: "240px",
  topBarHeight: "56px",
  maxContentWidth: "1200px",
} as const;
