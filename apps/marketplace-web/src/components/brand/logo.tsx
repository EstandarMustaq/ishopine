import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoVariant = "mark" | "wordmark" | "horizontal" | "icon";

/** Text wordmark only — no pictorial logo (Polaris / merchant brand). */
export function BrandLogo({
  variant = "wordmark",
  className,
  href = "/",
  priority: _priority,
}: {
  variant?: LogoVariant;
  className?: string;
  href?: string | null;
  priority?: boolean;
  showSlogan?: boolean;
}) {
  void _priority;
  void variant;

  const content = (
    <span
      className={cn(
        "text-[17px] font-bold tracking-[-0.02em] text-[var(--ds-text)] sm:text-xl",
        className,
      )}
    >
      iShopine
    </span>
  );

  if (!href) return content;
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center"
      aria-label="iShopine"
    >
      {content}
    </Link>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-bold tracking-[-0.02em] text-[var(--ds-text)]",
        className,
      )}
    >
      iShopine
    </span>
  );
}
