import * as React from "react";
import { cn } from "./lib/cn";

export type BadgeTone = "default" | "success" | "warning" | "critical" | "info";

const toneClass: Record<BadgeTone, string> = {
  default: "bg-[var(--ds-bg)] text-[var(--ds-text-secondary)]",
  success: "bg-[rgba(0,128,96,0.12)] text-[var(--ds-brand-dark)]",
  warning: "bg-[rgba(255,196,83,0.25)] text-[var(--ds-text)]",
  critical: "bg-[rgba(215,44,13,0.12)] text-[var(--ds-critical)]",
  info: "bg-[var(--ds-highlight)] text-[var(--ds-interactive)]",
};

export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--ds-radius-full)] px-2.5 py-0.5 text-[12px] font-medium",
        toneClass[tone],
        className,
      )}
      {...props}
    />
  );
}
