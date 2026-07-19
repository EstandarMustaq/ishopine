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
          "rounded-xl bg-[#111111] px-3.5 py-2 text-white shadow-soft hover:bg-black active:bg-zinc-900",
        outline:
          "rounded-xl border-zinc-200/80 bg-white/60 text-zinc-900 shadow-sm backdrop-blur-sm hover:bg-zinc-50 hover:text-foreground aria-expanded:bg-zinc-50",
        secondary:
          "rounded-xl bg-zinc-100 text-zinc-900 hover:bg-zinc-200/80 aria-expanded:bg-zinc-100",
        ghost:
          "rounded-xl text-zinc-700 hover:bg-zinc-100/80 hover:text-zinc-900 aria-expanded:bg-zinc-100",
        destructive:
          "rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/15 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "rounded-xl text-zinc-900 underline-offset-4 hover:underline",
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
