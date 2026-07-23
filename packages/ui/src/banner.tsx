import * as React from "react";
import { cn } from "./lib/cn";

export type BannerTone = "info" | "success" | "warning" | "critical";

const toneClass: Record<BannerTone, string> = {
  info: "border-[var(--ds-interactive)] bg-[var(--ds-highlight)] text-[var(--ds-text)]",
  success:
    "border-[var(--ds-brand)] bg-[rgba(0,128,96,0.08)] text-[var(--ds-text)]",
  warning:
    "border-[var(--ds-warning)] bg-[rgba(255,196,83,0.2)] text-[var(--ds-text)]",
  critical:
    "border-[var(--ds-critical)] bg-[rgba(215,44,13,0.08)] text-[var(--ds-text)]",
};

export function Banner({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: BannerTone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--ds-radius-md)] border px-4 py-3 text-[14px]",
        toneClass[tone],
        className,
      )}
      role="status"
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={cn(title && "mt-1")}>{children}</div> : null}
    </div>
  );
}
