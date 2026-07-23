"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Heart,
  Home,
  LogOut,
  MapPin,
  Package,
  ShoppingBag,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/types";

const MARKETPLACE =
  process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3000";

const NAV = [
  { href: "/", label: "Resumo", icon: Home },
  { href: "/pedidos", label: "Pedidos", icon: Package },
  { href: "/enderecos", label: "Endereços", icon: MapPin },
  { href: "/favoritos", label: "Favoritos", icon: Heart },
];

function consumeHandoffToken(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const handoff = params.get("token");
  if (!handoff) return null;
  params.delete("token");
  const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
  window.history.replaceState({}, "", clean);
  return handoff;
}

export function CustomerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { accessToken, user, setAuth, logout } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const handoff = consumeHandoffToken();
      try {
        if (handoff) {
          const me = await apiFetch<User>("/auth/me", { token: handoff });
          if (cancelled) return;
          setAuth(handoff, me);
        } else if (!useAuthStore.getState().accessToken) {
          const me = await apiFetch<User>("/auth/me", { token: null });
          if (cancelled) return;
          setAuth("", me);
        }
      } catch {
        if (!useAuthStore.getState().accessToken) {
          window.location.href = `${MARKETPLACE}/entrar?next=customer`;
          return;
        }
      }
      if (!cancelled) setReady(true);
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [setAuth]);

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[var(--ds-bg)] text-[14px] text-[var(--ds-text-secondary)]">
        A carregar conta…
      </div>
    );
  }

  if (!accessToken && !user) {
    return null;
  }

  return (
    <div className="flex min-h-svh flex-col bg-[var(--ds-bg)]">
      <header className="bg-[var(--ds-topbar)] text-white">
        <div className="mx-auto flex h-[var(--ds-topbar-height)] max-w-5xl items-center gap-3 px-4">
          <Link href="/" className="text-[15px] font-semibold">
            iShopine
          </Link>
          <span className="text-white/50">/</span>
          <span className="text-[13px] text-white/80">Minha conta</span>
          <div className="ml-auto flex items-center gap-3">
            <a
              href={MARKETPLACE}
              className="hidden items-center gap-1 text-[13px] text-white/70 hover:text-white sm:inline-flex"
            >
              <ShoppingBag className="size-3.5" />
              Continuar a comprar
            </a>
            <span className="flex size-8 items-center justify-center rounded-full bg-[var(--ds-brand)] text-[12px] font-semibold">
              {(user?.name || "C")
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>
            <button
              type="button"
              aria-label="Sair"
              className="text-white/70 hover:text-white"
              onClick={() => {
                logout();
                window.location.href = `${MARKETPLACE}/entrar`;
              }}
            >
              <LogOut className="size-4" />
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
                  "inline-flex min-h-10 items-center gap-1.5 rounded-[var(--ds-radius-sm)] px-3 py-1.5 text-[14px]",
                  active
                    ? "bg-white/15 font-medium"
                    : "text-white/70 hover:bg-white/10",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
