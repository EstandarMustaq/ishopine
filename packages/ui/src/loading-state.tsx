import * as React from "react";
import { cn } from "./lib/cn";

export type LoadingStateProps = {
  label?: string;
  variant?: "spinner" | "skeleton";
  className?: string;
};

export function LoadingState({
  label = "A carregar",
  variant = "spinner",
  className,
}: LoadingStateProps) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "rounded-[var(--ds-radius-md)] border border-[var(--ds-border-subdued)] bg-[var(--ds-surface)] px-6 py-8 text-[14px] text-[var(--ds-text-secondary)] shadow-[var(--ds-shadow-raised)]",
        className,
      )}
      role="status"
    >
      {variant === "skeleton" ? (
        <div className="space-y-3">
          <div className="h-4 w-32 animate-pulse rounded-[var(--ds-radius-sm)] bg-[var(--ds-border-subdued)]" />
          <div className="h-3 w-full max-w-lg animate-pulse rounded-[var(--ds-radius-sm)] bg-[var(--ds-border-subdued)]" />
          <div className="h-3 w-3/4 max-w-md animate-pulse rounded-[var(--ds-radius-sm)] bg-[var(--ds-border-subdued)]" />
          <span className="sr-only">{label}</span>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3">
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-[var(--ds-radius-full)] border-2 border-[var(--ds-border)] border-t-[var(--ds-brand)]"
          />
          <span>{label}</span>
        </div>
      )}
    </div>
  );
}
