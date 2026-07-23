import * as React from "react";
import { cn } from "./lib/cn";
import { Input } from "./input";

export type NavItem = {
  id: string;
  label: string;
  href?: string;
  icon?: React.ReactNode;
  active?: boolean;
};

export type AdminShellProps = {
  brand?: React.ReactNode;
  storeLabel?: string;
  avatarInitials?: string;
  searchPlaceholder?: string;
  navItems: NavItem[];
  sections?: Array<{ title: string; items: NavItem[] }>;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  onNavigate?: (item: NavItem) => void;
};

/**
 * Polaris-style admin chrome: dark top bar + light sidebar + page canvas.
 * Mobile: sidebar becomes overlay (parent controls open state via CSS).
 */
export function AdminShell({
  brand = "iShopine",
  storeLabel = "Minha loja",
  avatarInitials = "IS",
  searchPlaceholder = "Search",
  navItems,
  sections,
  footer,
  children,
  className,
  onNavigate,
}: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div
      className={cn(
        "flex h-svh flex-col overflow-hidden bg-[var(--ds-bg)] font-[family-name:var(--ds-font-sans)] text-[var(--ds-text)]",
        className,
      )}
    >
      <header
        className="flex h-[var(--ds-topbar-height)] shrink-0 items-center gap-3 bg-[var(--ds-topbar)] px-3 text-white"
        role="banner"
      >
        <button
          type="button"
          className="flex size-10 items-center justify-center rounded-[var(--ds-radius-sm)] hover:bg-white/10 md:hidden"
          aria-label="Menu"
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span aria-hidden className="text-lg leading-none">
            ☰
          </span>
        </button>
        <div className="hidden items-center gap-2 md:flex">
          <span className="text-[15px] font-semibold tracking-tight">{brand}</span>
        </div>
        <div className="mx-auto flex w-full max-w-xl flex-1 items-center">
          <div className="relative w-full">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50">
              ⌕
            </span>
            <Input
              className="h-9 border-0 bg-[#2c2c2c] pl-9 text-white placeholder:text-white/50 focus-visible:border-transparent focus-visible:ring-white/20"
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-[13px] text-white/80 sm:inline">
            {storeLabel}
          </span>
          <span
            className="flex size-8 items-center justify-center rounded-full bg-[var(--ds-brand)] text-[12px] font-semibold text-white"
            aria-hidden
          >
            {avatarInitials}
          </span>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {mobileOpen ? (
          <button
            type="button"
            className="absolute inset-0 z-20 bg-black/30 md:hidden"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}

        <aside
          className={cn(
            "z-30 flex h-full w-[var(--ds-sidebar-width)] shrink-0 flex-col border-r border-[var(--ds-border-subdued)] bg-[var(--ds-sidebar)] transition-transform md:static md:translate-x-0",
            mobileOpen
              ? "absolute inset-y-0 left-0 translate-x-0"
              : "absolute inset-y-0 left-0 -translate-x-full md:translate-x-0",
          )}
        >
          <nav className="flex-1 overflow-y-auto p-2" aria-label="Principal">
            <ul className="space-y-0.5">
              {navItems.map((item) => (
                <li key={item.id}>
                  <NavLink item={item} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
            {sections?.map((section) => (
              <div key={section.title} className="mt-4">
                <p className="px-3 py-1 text-[12px] font-medium uppercase tracking-wide text-[var(--ds-text-secondary)]">
                  {section.title}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {section.items.map((item) => (
                    <li key={item.id}>
                      <NavLink item={item} onNavigate={onNavigate} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          {footer ? (
            <div className="border-t border-[var(--ds-border-subdued)] p-2">
              {footer}
            </div>
          ) : null}
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto w-full max-w-[var(--ds-max-width)]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function NavLink({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate?: (item: NavItem) => void;
}) {
  const className = cn(
    "flex min-h-11 w-full items-center gap-2 rounded-[var(--ds-radius-sm)] px-3 py-2 text-left text-[14px] transition-colors",
    item.active
      ? "bg-[var(--ds-sidebar-active)] font-medium text-[var(--ds-text)] shadow-[var(--ds-shadow-raised)]"
      : "text-[var(--ds-text)] hover:bg-black/[0.04]",
  );

  if (item.href) {
    return (
      <a
        href={item.href}
        className={className}
        aria-current={item.active ? "page" : undefined}
        onClick={() => onNavigate?.(item)}
      >
        {item.icon}
        <span>{item.label}</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      className={className}
      aria-current={item.active ? "page" : undefined}
      onClick={() => onNavigate?.(item)}
    >
      {item.icon}
      <span>{item.label}</span>
    </button>
  );
}
