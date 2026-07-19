import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center border border-transparent bg-clip-padding whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "rounded-[14px] bg-[#61005D] py-3.5 px-4 text-sm font-bold text-white hover:bg-[#4A0048] active:bg-[#330032]",
        outline:
          "rounded-[14px] border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "rounded-[14px] bg-secondary text-secondary-foreground hover:bg-[#E8E6E8] aria-expanded:bg-secondary",
        ghost:
          "rounded-[14px] hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "rounded-[14px] bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "rounded-[14px] text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-auto gap-1.5 min-h-11",
        xs: "h-6 gap-1 rounded-[14px] px-2 py-1 text-xs font-bold [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1 rounded-[14px] px-3 py-2 text-[0.8rem] font-bold [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-auto min-h-12 gap-1.5 px-6 py-3.5 text-sm font-bold",
        icon: "size-10 rounded-[14px]",
        "icon-xs": "size-6 rounded-[14px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-[14px]",
        "icon-lg": "size-11 rounded-[14px]",
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
