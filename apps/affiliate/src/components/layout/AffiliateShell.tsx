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
      <div className="min-h-screen bg-[var(--brand-surface)]">
        <header className="sticky top-0 z-40 border-b border-[var(--brand-border)] bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/ishopine-mark.svg" alt="" className="h-8 w-8" />
              <span className="text-lg font-semibold text-[var(--brand-ink)]">
                Afiliados
              </span>
            </Link>
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-[var(--brand-muted)] sm:inline">
                {user?.name}
              </span>
              <a
                href={MARKETPLACE_URL}
                className="inline-flex items-center gap-1 text-[var(--brand-muted)] hover:text-[var(--brand-ink)]"
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
                className="text-[var(--brand-muted)] hover:text-red-600"
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
                    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-[var(--brand-orange)] text-white"
                      : "text-[var(--brand-muted)] hover:bg-[var(--brand-orange-soft)] hover:text-[var(--brand-ink)]",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </div>
    </AuthGate>
  );
}
