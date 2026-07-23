import type { Config } from "tailwindcss";
import {
  colors,
  elevation,
  radius,
  space,
  typography,
} from "./tokens";

const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: colors.brand.green,
          dark: colors.brand.greenDark,
        },
        interactive: colors.interactive.blue,
        ink: {
          DEFAULT: colors.text.primary,
          secondary: colors.text.secondary,
          disabled: colors.text.disabled,
        },
        page: colors.surface.background,
        surface: colors.surface.surface,
        line: {
          DEFAULT: colors.surface.border,
          subdued: colors.surface.borderSubdued,
        },
        nav: {
          top: colors.nav.topBar,
          sidebar: colors.nav.sidebar,
          active: colors.nav.sidebarActive,
        },
        success: colors.semantic.success,
        warning: colors.semantic.warning,
        critical: colors.semantic.critical,
        highlight: colors.semantic.highlight,
      },
      fontFamily: {
        sans: [...typography.fontFamily.sans],
        code: [...typography.fontFamily.code],
      },
      fontSize: {
        display: [typography.size.display, { lineHeight: "1.1", fontWeight: "700", letterSpacing: "-0.02em" }],
        h1: [typography.size.h1, { lineHeight: "1.2", fontWeight: "700", letterSpacing: "-0.01em" }],
        h2: [typography.size.h2, { lineHeight: "1.3", fontWeight: "600" }],
        h3: [typography.size.h3, { lineHeight: "1.4", fontWeight: "600" }],
        body: [typography.size.body, { lineHeight: "1.6" }],
        caption: [typography.size.caption, { lineHeight: "1.5", letterSpacing: "0.01em" }],
      },
      borderRadius: {
        sm: radius.sm,
        md: radius.md,
        lg: radius.lg,
        button: radius.sm,
        input: radius.sm,
        card: radius.md,
      },
      spacing: {
        "ds-1": space[1],
        "ds-2": space[2],
        "ds-3": space[3],
        "ds-4": space[4],
        "ds-5": space[5],
        "ds-6": space[6],
        "ds-8": space[8],
        "ds-10": space[10],
      },
      boxShadow: {
        raised: elevation.raised,
        overlay: elevation.overlay,
        modal: elevation.modal,
      },
    },
  },
};

export default preset;
