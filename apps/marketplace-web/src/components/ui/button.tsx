import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center border border-transparent bg-clip-padding whitespace-nowrap text-[14px] font-medium tracking-[0.01em] transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-[rgba(0,128,96,0.2)] active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-[var(--ds-critical)] aria-invalid:ring-2 aria-invalid:ring-[rgba(215,44,13,0.2)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 rounded-[var(--ds-radius-sm)]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--ds-brand)] px-4 py-2 text-white hover:bg-[var(--ds-brand-dark)]",
        outline:
          "border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--ds-text)] hover:bg-[var(--ds-bg)]",
        secondary:
          "border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--ds-text)] hover:bg-[var(--ds-bg)]",
        ghost:
          "bg-transparent text-[var(--ds-text)] hover:bg-[var(--ds-bg)]",
        destructive:
          "bg-[var(--ds-critical)] text-white hover:opacity-90",
        link: "bg-transparent text-[var(--ds-brand)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 min-h-9 gap-1.5 px-4",
        xs: "h-6 gap-1 px-2 py-0.5 text-[12px]",
        sm: "h-8 gap-1 px-3 text-[13px]",
        lg: "h-10 min-h-10 gap-1.5 px-5 text-[14px]",
        icon: "size-9",
        "icon-xs": "size-6",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
