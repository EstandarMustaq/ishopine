"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Heart,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Package,
  ShoppingBag,
  Store,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SiteSearch } from "@/components/search/site-search";
import { api } from "@/lib/api";
import { appHandoffUrl, getAppUrls } from "@/lib/app-urls";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/produtos", label: "Mercado", icon: Package },
  { href: "/lojas", label: "Lojas", icon: Store },
  { href: "/vender", label: "Vender", icon: LayoutDashboard },
  { href: "/conta", label: "Conta", icon: User },
];

function BrandWordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "text-[18px] font-bold tracking-[-0.02em] text-[var(--ds-text)]",
        className,
      )}
      aria-label="iShopine"
    >
      iShopine
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);
  const canAccessPainel = useAuthStore((s) => s.canAccessPainel);
  const isStaff = useAuthStore((s) => s.isStaff);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !accessToken) {
      setUnreadCount(0);
      return;
    }
    let cancelled = false;
    api<
      | {
          items?: Array<{ readAt?: string | null; isRead?: boolean }>;
          unreadCount?: number;
        }
      | Array<{ readAt?: string | null; isRead?: boolean }>
    >("/notifications")
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data)) {
          setUnreadCount(data.filter((n) => !n.isRead && !n.readAt).length);
          return;
        }
        if (typeof data.unreadCount === "number") {
          setUnreadCount(data.unreadCount);
          return;
        }
        const items = data.items ?? [];
        setUnreadCount(items.filter((n) => !n.isRead && !n.readAt).length);
      })
      .catch(() => {
        if (!cancelled) setUnreadCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [mounted, accessToken, pathname]);

  const showPainel = mounted && canAccessPainel();
  const painelHref = accessToken
    ? appHandoffUrl(isStaff() ? "backoffice" : "seller", accessToken, "/")
    : `${getAppUrls().seller}/`;

  return (
    <header className="sticky top-0 z-40 h-[var(--ds-topbar-height)] border-b border-[var(--ds-topbar-border)] bg-[var(--ds-topbar)]">
      <div className="mx-auto flex h-full max-w-[var(--ds-max-width)] items-center gap-3 px-4 sm:px-6">
        <BrandWordmark className="shrink-0" />

        <div className="hidden min-w-0 flex-1 md:block md:max-w-sm lg:max-w-md">
          <SiteSearch variant="nav" />
        </div>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const active =
              link.href === "/produtos"
                ? pathname.startsWith("/produtos")
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-[var(--ds-radius-sm)] px-3 text-[14px] font-medium transition-colors",
                  active
                    ? "bg-[var(--ds-bg)] text-[var(--ds-text)]"
                    : "text-[var(--ds-text-secondary)] hover:bg-[var(--ds-bg)] hover:text-[var(--ds-text)]",
                )}
              >
                {link.label}
              </Link>
            );
          })}
          {showPainel ? (
            <a
              href={painelHref}
              className="inline-flex min-h-11 items-center rounded-[var(--ds-radius-sm)] px-3 text-[14px] font-medium text-[var(--ds-text-secondary)] hover:bg-[var(--ds-bg)] hover:text-[var(--ds-text)]"
            >
              Painel
            </a>
          ) : null}
        </nav>

        <div className="flex items-center gap-1 md:ml-2">
          {mounted && user ? (
            <>
              <Button variant="ghost" size="icon-sm" asChild className="relative">
                <Link href="/notificacoes" aria-label="Notificações">
                  <Bell />
                  {unreadCount > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-[var(--ds-radius-full)] bg-[var(--ds-critical)] px-1 text-[10px] font-semibold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </Link>
              </Button>
              <Button variant="ghost" size="icon-sm" asChild className="hidden sm:inline-flex">
                <Link href="/mensagens" aria-label="Mensagens">
                  <MessageCircle />
                </Link>
              </Button>
              <Button variant="ghost" size="icon-sm" asChild className="hidden sm:inline-flex">
                <Link href="/favoritos" aria-label="Favoritos">
                  <Heart />
                </Link>
              </Button>
            </>
          ) : null}

          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/carrinho" aria-label="Carrinho">
              <ShoppingBag />
            </Link>
          </Button>

          {mounted && user ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="ghost" size="sm" asChild>
                <a
                  href={
                    accessToken
                      ? appHandoffUrl("customer", accessToken, "/")
                      : "/conta"
                  }
                >
                  {user.name.split(" ")[0]}
                </a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  logout();
                  router.push("/");
                }}
              >
                Sair
              </Button>
            </div>
          ) : (
            <Button variant="default" size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/entrar">Entrar</Link>
            </Button>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="md:hidden">
                <Menu />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[280px] border-l border-[var(--ds-border-subdued)] bg-[var(--ds-surface)]"
            >
              <SheetHeader>
                <SheetTitle className="text-left text-[18px] font-bold tracking-[-0.02em]">
                  iShopine
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center rounded-[var(--ds-radius-sm)] px-3 text-[14px] font-medium text-[var(--ds-text)] hover:bg-[var(--ds-bg)]"
                  >
                    {link.label}
                  </Link>
                ))}
                {showPainel ? (
                  <a
                    href={painelHref}
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center rounded-[var(--ds-radius-sm)] px-3 text-[14px] font-medium text-[var(--ds-text)] hover:bg-[var(--ds-bg)]"
                  >
                    Painel
                  </a>
                ) : null}
                {mounted && user ? (
                  <Button
                    variant="outline"
                    className="mt-3"
                    onClick={() => {
                      logout();
                      setOpen(false);
                      router.push("/");
                    }}
                  >
                    Sair
                  </Button>
                ) : (
                  <Button asChild className="mt-3">
                    <Link href="/entrar" onClick={() => setOpen(false)}>
                      Entrar
                    </Link>
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
