"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, ShoppingBag, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/produtos", label: "Produtos" },
  { href: "/carrinho", label: "Carrinho" },
  { href: "/conta", label: "Minha conta" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isStaff = useAuthStore((s) => s.isStaff);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const staff = mounted && isStaff();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--mavula-nav-divider)] bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-[#61005D] sm:text-2xl"
        >
          Mavula
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
          {staff && (
            <Link
              href="/painel"
              className="text-sm font-medium text-taupe transition-colors hover:text-[#61005D]"
            >
              Painel
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
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
                <SheetTitle className="text-[#61005D]">Mavula</SheetTitle>
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
                {staff && (
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
