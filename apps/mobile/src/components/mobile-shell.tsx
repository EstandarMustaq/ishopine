"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, ShoppingCart, User } from "lucide-react";
import { cn } from "@/lib/utils";

const MARKETPLACE =
  process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3000";
const CUSTOMER =
  process.env.NEXT_PUBLIC_CUSTOMER_URL || "http://localhost:3004";

const TABS = [
  { href: "/", label: "Início", icon: Home },
  { href: "/buscar", label: "Buscar", icon: Search },
  { href: `${MARKETPLACE}/carrinho`, label: "Carrinho", icon: ShoppingCart, external: true },
  { href: CUSTOMER, label: "Conta", icon: User, external: true },
] as const;

export function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col bg-[var(--ds-bg)]">
      <header className="sticky top-0 z-40 bg-[var(--ds-topbar)] text-white">
        <div className="flex h-12 items-center justify-between px-4">
          <Link href="/" className="text-[16px] font-semibold tracking-tight">
            iShopine
          </Link>
          <a
            href={MARKETPLACE}
            className="text-[12px] text-white/70 hover:text-white"
          >
            Versão completa
          </a>
        </div>
      </header>

      <main className="flex-1 pb-20">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--ds-border-subdued)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const external = "external" in tab && tab.external;
            const active =
              !external &&
              (tab.href === "/"
                ? pathname === "/"
                : pathname.startsWith(tab.href));
            const className = cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px]",
              active
                ? "font-semibold text-[var(--ds-brand)]"
                : "text-[var(--ds-text-secondary)]",
            );
            if (external) {
              return (
                <a key={tab.label} href={tab.href} className={className}>
                  <Icon className="size-5" />
                  {tab.label}
                </a>
              );
            }
            return (
              <Link key={tab.label} href={tab.href} className={className}>
                <Icon className="size-5" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
