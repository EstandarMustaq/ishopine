"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Heart, Menu, MessageCircle, ShoppingBag, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/produtos", label: "Mercado" },
  { href: "/lojas", label: "Lojas" },
  { href: "/vender", label: "Vender" },
  { href: "/carrinho", label: "Carrinho" },
  { href: "/conta", label: "Minha conta" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);
  const canAccessPainel = useAuthStore((s) => s.canAccessPainel);
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
    api<{ items?: Array<{ readAt?: string | null; isRead?: boolean }>; unreadCount?: number } | Array<{ readAt?: string | null; isRead?: boolean }>>(
      "/notifications",
    )
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data)) {
          setUnreadCount(
            data.filter((n) => !n.isRead && !n.readAt).length,
          );
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

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--brand-nav-divider)] bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-[#61005D] sm:text-2xl"
        >
          iShoppine
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium text-charcoal transition-colors hover:text-[#61005D]",
                pathname.startsWith(link.href) && "text-[#61005D]",
              )}
            >
              {link.label}
            </Link>
          ))}
          {showPainel && (
            <Link
              href="/painel"
              className="text-sm font-medium text-taupe transition-colors hover:text-[#61005D]"
            >
              Painel
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          {mounted && user && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                asChild
                className="relative text-charcoal"
              >
                <Link href="/notificacoes" aria-label="Notificações">
                  <Bell />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#61005D] px-1 text-[10px] font-semibold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                asChild
                className="hidden text-charcoal sm:inline-flex"
              >
                <Link href="/mensagens" aria-label="Mensagens">
                  <MessageCircle />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                asChild
                className="hidden text-charcoal sm:inline-flex"
              >
                <Link href="/favoritos" aria-label="Favoritos">
                  <Heart />
                </Link>
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            asChild
            className="text-charcoal"
          >
            <Link href="/carrinho" aria-label="Carrinho">
              <ShoppingBag />
            </Link>
          </Button>

          {mounted && user ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/conta">
                  <User className="mr-1" />
                  {user.name.split(" ")[0]}
                </Link>
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
            <SheetContent side="right" className="w-[280px]">
              <SheetHeader>
                <SheetTitle className="text-[#61005D]">iShoppine</SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-3">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="rounded-[12px] px-3 py-2 text-sm font-medium hover:bg-beige"
                  >
                    {link.label}
                  </Link>
                ))}
                {mounted && user && (
                  <>
                    <Link
                      href="/favoritos"
                      onClick={() => setOpen(false)}
                      className="rounded-[12px] px-3 py-2 text-sm font-medium hover:bg-beige"
                    >
                      Favoritos
                    </Link>
                    <Link
                      href="/mensagens"
                      onClick={() => setOpen(false)}
                      className="rounded-[12px] px-3 py-2 text-sm font-medium hover:bg-beige"
                    >
                      Mensagens
                    </Link>
                    <Link
                      href="/notificacoes"
                      onClick={() => setOpen(false)}
                      className="rounded-[12px] px-3 py-2 text-sm font-medium hover:bg-beige"
                    >
                      Notificações
                      {unreadCount > 0 ? ` (${unreadCount})` : ""}
                    </Link>
                  </>
                )}
                {showPainel && (
                  <Link
                    href="/painel"
                    onClick={() => setOpen(false)}
                    className="rounded-[12px] px-3 py-2 text-sm font-medium hover:bg-beige"
                  >
                    Painel
                  </Link>
                )}
                {mounted && user ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      logout();
                      setOpen(false);
                      router.push("/");
                    }}
                  >
                    Sair
                  </Button>
                ) : (
                  <Button asChild>
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
