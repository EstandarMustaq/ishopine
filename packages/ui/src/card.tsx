import * as React from "react";
import { cn } from "./lib/cn";

export function Card({
  className,
  padding = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  padding?: "default" | "none";
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--ds-radius-md)] border border-[var(--ds-border-subdued)] bg-[var(--ds-surface)] shadow-[var(--ds-shadow-raised)]",
        padding === "default" ? "p-5" : "p-0",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-3 flex items-start justify-between gap-3", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-[16px] font-semibold leading-[1.4] text-[var(--ds-text)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-[14px] leading-[1.6] text-[var(--ds-text-secondary)]", className)}
      {...props}
    />
  );
}
