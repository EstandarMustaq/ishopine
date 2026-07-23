import * as React from "react";
import { cn } from "./lib/cn";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--ds-radius-full)] bg-[var(--ds-bg)] px-2.5 py-0.5 text-[12px] font-medium text-[var(--ds-text-secondary)]",
        className,
      )}
      {...props}
    />
  );
}
