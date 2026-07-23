import * as React from "react";
import { cn } from "./lib/cn";
import { Button } from "./button";

export type PageHeaderProps = {
  title: string;
  /** Preferred copy field */
  description?: string;
  /** Alias of description (Polaris-style) */
  subtitle?: string;
  actions?: React.ReactNode;
  primaryAction?: {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    href?: string;
  };
  className?: string;
};

export function PageHeader({
  title,
  description,
  subtitle,
  actions,
  primaryAction,
  className,
}: PageHeaderProps) {
  const copy = description ?? subtitle;
  const actionNode =
    actions ??
    (primaryAction ? (
      primaryAction.href ? (
        <a
          href={primaryAction.href}
          className={cn(
            "inline-flex h-9 items-center justify-center rounded-[var(--ds-radius-sm)] bg-[var(--ds-brand)] px-4 text-[14px] font-medium text-white hover:bg-[var(--ds-brand-dark)]",
            primaryAction.disabled && "pointer-events-none opacity-50",
          )}
        >
          {primaryAction.label}
        </a>
      ) : (
        <Button
          variant="primary"
          onClick={primaryAction.onClick}
          disabled={primaryAction.disabled}
        >
          {primaryAction.label}
        </Button>
      )
    ) : null);

  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div>
        <h1 className="text-[28px] font-bold leading-[1.2] tracking-[-0.01em] text-[var(--ds-text)]">
          {title}
        </h1>
        {copy ? (
          <p className="mt-1 text-[14px] text-[var(--ds-text-secondary)]">{copy}</p>
        ) : null}
      </div>
      {actionNode ? (
        <div className="flex flex-wrap items-center gap-2">{actionNode}</div>
      ) : null}
    </div>
  );
}
