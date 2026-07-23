import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center border border-transparent bg-clip-padding whitespace-nowrap text-[13px] font-medium tracking-tight transition-all duration-200 outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "rounded-full bg-[var(--ds-brand)] px-3.5 py-2 text-white shadow-soft hover:bg-[var(--ds-brand-dark)] active:bg-[var(--ds-brand-dark)]",
        outline:
          "rounded-full border-[var(--brand-border)] bg-white text-[var(--brand-charcoal)] shadow-sm hover:bg-[var(--brand-surface)] hover:text-foreground aria-expanded:bg-[var(--brand-surface)]",
        secondary:
          "rounded-full bg-[rgba(0,128,96,0.1)] text-[var(--ds-brand)] hover:bg-[rgba(0,128,96,0.16)] aria-expanded:bg-[rgba(0,128,96,0.1)]",
        ghost:
          "rounded-full text-[var(--brand-charcoal)] hover:bg-[var(--brand-surface)] hover:text-[var(--brand-ink)] aria-expanded:bg-[var(--brand-surface)]",
        destructive:
          "rounded-full bg-destructive/10 text-destructive hover:bg-destructive/15 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "rounded-full text-[var(--ds-brand)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 gap-1.5 min-h-9",
        xs: "h-6 gap-1 rounded-lg px-2 py-0.5 text-[12px] font-medium [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-medium [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 min-h-10 gap-1.5 px-5 py-2.5 text-[14px] font-medium",
        icon: "size-9 rounded-xl",
        "icon-xs": "size-6 rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-lg",
        "icon-lg": "size-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
