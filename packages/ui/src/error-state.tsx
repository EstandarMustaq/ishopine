import * as React from "react";
import { Button } from "./button";
import { cn } from "./lib/cn";

export type ErrorStateProps = {
  title: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
  action?: React.ReactNode;
  className?: string;
};

export function ErrorState({
  title,
  description,
  retryLabel = "Tentar novamente",
  onRetry,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--ds-radius-md)] border border-[rgba(215,44,13,0.35)] bg-[rgba(215,44,13,0.06)] px-6 py-8 text-center shadow-[var(--ds-shadow-raised)]",
        className,
      )}
      role="alert"
    >
      <h2 className="text-[18px] font-semibold text-[var(--ds-text)]">{title}</h2>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-[14px] leading-[1.6] text-[var(--ds-text-secondary)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
      {!action && onRetry ? (
        <Button className="mt-5" variant="secondary" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
