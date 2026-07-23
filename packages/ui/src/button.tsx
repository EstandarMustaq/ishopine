import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-[family-name:var(--ds-font-sans)] text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,128,96,0.2)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--ds-brand)] text-white hover:bg-[var(--ds-brand-dark)] rounded-[var(--ds-radius-sm)] px-4 py-2",
        secondary:
          "bg-[var(--ds-surface)] text-[var(--ds-text)] border border-[var(--ds-border)] hover:bg-[var(--ds-bg)] rounded-[var(--ds-radius-sm)] px-4 py-2",
        destructive:
          "bg-[var(--ds-critical)] text-white hover:opacity-90 rounded-[var(--ds-radius-sm)] px-4 py-2",
        plain:
          "bg-transparent text-[var(--ds-brand)] hover:underline rounded-[var(--ds-radius-sm)] px-2 py-1",
        dark:
          "bg-[var(--ds-topbar)] text-white hover:bg-black rounded-[var(--ds-radius-sm)] px-4 py-2",
      },
      size: {
        default: "h-9 min-w-[44px]",
        sm: "h-8 px-3 text-[13px]",
        lg: "h-10 px-5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
