import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoVariant = "mark" | "wordmark" | "horizontal" | "icon";

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

  const content =
    variant === "wordmark" || variant === "horizontal" ? (
      <span className={cn("inline-flex items-center gap-2", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/ishopine-mark.svg"
          alt=""
          width={28}
          height={28}
          className="size-7"
        />
        <span className="text-[17px] font-bold tracking-tight sm:text-xl">
          <span className="text-[var(--ds-brand)]">i</span>
          <span className="text-[var(--brand-charcoal)]">Shopine</span>
        </span>
      </span>
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={
          variant === "icon"
            ? "/brand/ishopine-icon.svg"
            : "/brand/ishopine-mark.svg"
        }
        alt="iShopine"
        width={variant === "icon" ? 40 : 32}
        height={variant === "icon" ? 40 : 32}
        className={cn(variant === "icon" ? "size-10" : "size-8", className)}
      />
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
    <span className={cn("font-bold tracking-tight", className)}>
      <span className="text-[var(--ds-brand)]">i</span>
      <span className="text-[var(--brand-charcoal)]">Shopine</span>
    </span>
  );
}
