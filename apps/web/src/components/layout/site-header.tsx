"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  CircleDollarSign,
  Heart,
  LayoutDashboard,
  LogIn,
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
import { BrandLogo } from "@/components/brand/logo";
import { api } from "@/lib/api";
import { appHandoffUrl, getAppUrls } from "@/lib/app-urls";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/produtos", label: "mercado", icon: Package },
  { href: "/lojas", label: "lojas", icon: Store },
  { href: "/vender", label: "vender", icon: CircleDollarSign },
  { href: "/carrinho", label: "carrinho", icon: ShoppingBag },
  { href: "/conta", label: "conta", icon: User },
];

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
  const painelHref = accessToken
    ? appHandoffUrl(isStaff() ? "backoffice" : "seller", accessToken, "/")
    : `${getAppUrls().seller}/`;

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-100 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-3 sm:h-16 sm:gap-4 sm:px-6">
        <BrandLogo variant="wordmark" priority className="shrink-0" />

        <div className="hidden min-w-0 flex-1 md:block md:max-w-sm lg:max-w-md">
          <SiteSearch variant="nav" />
        </div>

        <nav className="ml-auto hidden items-center gap-0.5 md:flex">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-medium lowercase text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900",
                  active && "bg-zinc-100 text-zinc-900",
                )}
              >
                <Icon className="size-3.5 shrink-0 opacity-70" />
                {link.label}
              </Link>
            );
          })}
          {showPainel && (
            <a
              href={painelHref}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-medium lowercase text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              <LayoutDashboard className="size-3.5 shrink-0 opacity-70" />
              painel
            </a>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-0.5 md:ml-0 sm:gap-1">
          {mounted && user && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                asChild
                className="relative text-zinc-700"
              >
                <Link href="/notificacoes" aria-label="Notificações">
                  <Bell />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-zinc-900 px-1 text-[10px] font-semibold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                asChild
                className="hidden text-zinc-700 sm:inline-flex"
              >
                <Link href="/mensagens" aria-label="Mensagens">
                  <MessageCircle />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                asChild
                className="hidden text-zinc-700 sm:inline-flex"
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
            className="text-zinc-700"
          >
            <Link href="/carrinho" aria-label="Carrinho">
              <ShoppingBag />
            </Link>
          </Button>

          {mounted && user ? (
            <div className="hidden items-center gap-1 sm:flex">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/conta">
                  <User className="mr-1 size-3.5" />
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
            <Button
              variant="default"
              size="sm"
              asChild
              className="h-8 gap-1 rounded-full px-3 text-[12px] font-semibold sm:text-[13px]"
            >
              <Link href="/entrar" aria-label="Entrar">
                <LogIn className="size-3.5 shrink-0" />
                <span>entrar</span>
              </Link>
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
              className="w-[280px] border-l border-zinc-100 bg-white"
            >
              <SheetHeader>
                <SheetTitle asChild>
                  <BrandLogo variant="wordmark" href={null} className="justify-start" />
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 flex flex-col gap-1">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium lowercase text-zinc-700 transition-colors hover:bg-zinc-50"
                    >
                      <Icon className="size-4 shrink-0 text-zinc-500" />
                      <span className="flex-1">{link.label}</span>
                      <ArrowRight className="size-3.5 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-500" />
                    </Link>
                  );
                })}
                {mounted && user && (
                  <>
                    <Link
                      href="/favoritos"
                      onClick={() => setOpen(false)}
                      className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium lowercase text-zinc-700 hover:bg-zinc-50"
                    >
                      <Heart className="size-4 shrink-0 text-zinc-500" />
                      <span className="flex-1">favoritos</span>
                    </Link>
                    <Link
                      href="/mensagens"
                      onClick={() => setOpen(false)}
                      className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium lowercase text-zinc-700 hover:bg-zinc-50"
                    >
                      <MessageCircle className="size-4 shrink-0 text-zinc-500" />
                      <span className="flex-1">mensagens</span>
                    </Link>
                    <Link
                      href="/notificacoes"
                      onClick={() => setOpen(false)}
                      className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium lowercase text-zinc-700 hover:bg-zinc-50"
                    >
                      <Bell className="size-4 shrink-0 text-zinc-500" />
                      <span className="flex-1">
                        notificações
                        {unreadCount > 0 ? ` (${unreadCount})` : ""}
                      </span>
                    </Link>
                  </>
                )}
                {showPainel && (
                  <a
                    href={painelHref}
                    onClick={() => setOpen(false)}
                    className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium lowercase text-zinc-700 hover:bg-zinc-50"
                  >
                    <LayoutDashboard className="size-4 shrink-0 text-zinc-500" />
                    <span className="flex-1">painel</span>
                  </a>
                )}
                {mounted && user ? (
                  <Button
                    variant="outline"
                    className="mt-3 rounded-full"
                    onClick={() => {
                      logout();
                      setOpen(false);
                      router.push("/");
                    }}
                  >
                    sair
                  </Button>
                ) : (
                  <Button
                    asChild
                    className="mt-3 h-11 gap-2 rounded-full font-semibold"
                  >
                    <Link href="/entrar" onClick={() => setOpen(false)}>
                      <LogIn className="size-4" />
                      entrar
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
