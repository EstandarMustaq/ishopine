"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ExternalLink,
  Gift,
  LayoutDashboard,
  Link2,
  LogOut,
} from "lucide-react";
import { AuthGate } from "@/components/dashboard/auth-gate";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

const MARKETPLACE_URL =
  process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3000";

const NAV = [
  { href: "/", label: "Painel", icon: LayoutDashboard },
  { href: "/links", label: "Meus links", icon: Link2 },
  { href: "/recompensas", label: "Recompensas", icon: Gift },
];

export function AffiliateShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  return (
    <AuthGate affiliateAccess>
      <div className="min-h-screen bg-[var(--ds-bg)]">
        <header className="sticky top-0 z-40 border-b border-[var(--ds-topbar-border)] bg-[var(--ds-topbar)] text-[var(--ds-text)]">
          <div className="mx-auto flex h-[var(--ds-topbar-height)] max-w-5xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-[15px] font-semibold tracking-tight">
                iShopine
              </span>
              <span className="text-[13px] text-[var(--ds-text-secondary)]">
                Afiliados
              </span>
            </Link>
            <div className="flex items-center gap-3 text-[13px]">
              <span className="hidden text-[var(--ds-text-secondary)] sm:inline">{user?.name}</span>
              <a
                href={MARKETPLACE_URL}
                className="inline-flex items-center gap-1 text-[var(--ds-text-secondary)] hover:text-[var(--ds-text)]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Mercado
              </a>
              <button
                type="button"
                onClick={() => {
                  logout();
                  window.location.href = `${MARKETPLACE_URL}/entrar`;
                }}
                className="rounded-[var(--ds-radius-sm)] p-2 text-[var(--ds-text-secondary)] hover:bg-[var(--ds-bg)] hover:text-[var(--ds-text)]"
                aria-label="Sair"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
          <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-[var(--ds-radius-sm)] px-3 py-1.5 text-[14px] transition-colors",
                    active
                      ? "bg-[var(--ds-bg)] font-medium text-[var(--ds-text)]"
                      : "text-[var(--ds-text-secondary)] hover:bg-[var(--ds-bg)] hover:text-[var(--ds-text)]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </div>
    </AuthGate>
  );
}
