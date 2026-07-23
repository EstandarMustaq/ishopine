import * as React from "react";
import { cn } from "./lib/cn";
import { Button } from "./button";

export type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  illustration?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  icon,
  actionLabel,
  onAction,
  illustration,
  className,
}: EmptyStateProps) {
  const visual = icon ?? illustration;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--ds-radius-md)] border border-[var(--ds-border-subdued)] bg-[var(--ds-surface)] px-6 py-12 text-center shadow-[var(--ds-shadow-raised)]",
        className,
      )}
    >
      {visual ? (
        <div className="mb-5 text-[var(--ds-text-secondary)] [&_svg]:size-10">
          {visual}
        </div>
      ) : null}
      <h2 className="text-[20px] font-semibold text-[var(--ds-text)]">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-md text-[14px] leading-[1.6] text-[var(--ds-text-secondary)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
      {!action && actionLabel && onAction ? (
        <Button className="mt-6" variant="dark" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
