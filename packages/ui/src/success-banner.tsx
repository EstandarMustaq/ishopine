"use client";

import * as React from "react";
import { cn } from "./lib/cn";

export type SuccessBannerProps = {
  title?: string;
  children?: React.ReactNode;
  dismissLabel?: string;
  onDismiss?: () => void;
  className?: string;
};

export function SuccessBanner({
  title,
  children,
  dismissLabel = "Dispensar",
  onDismiss,
  className,
}: SuccessBannerProps) {
  const [visible, setVisible] = React.useState(true);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "flex gap-3 rounded-[var(--ds-radius-md)] border border-[var(--ds-success)] bg-[rgba(0,128,96,0.08)] px-4 py-3 text-[14px] text-[var(--ds-text)]",
        className,
      )}
      role="status"
    >
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-1")}>{children}</div> : null}
      </div>
      <button
        type="button"
        className="self-start rounded-[var(--ds-radius-sm)] px-2 py-1 text-[13px] font-medium text-[var(--ds-brand)] hover:bg-[rgba(0,128,96,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,128,96,0.2)]"
        onClick={() => {
          setVisible(false);
          onDismiss?.();
        }}
      >
        {dismissLabel}
      </button>
    </div>
  );
}
