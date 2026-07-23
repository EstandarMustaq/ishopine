import * as React from "react";
import { cn } from "./lib/cn";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-9 w-full rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2 text-[14px] text-[var(--ds-text)] placeholder:text-[var(--ds-text-disabled)] focus-visible:border-[var(--ds-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,128,96,0.2)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
