"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Boxes,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  Settings,
  Shield,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const links: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  adminOnly?: boolean;
}> = [
  { href: "/painel", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/painel/pedidos", label: "Pedidos", icon: ShoppingBag },
  { href: "/painel/produtos", label: "Produtos", icon: Package },
  { href: "/painel/estoque", label: "Estoque", icon: Boxes },
  {
    href: "/painel/contabilidade",
    label: "Contabilidade",
    icon: Receipt,
    adminOnly: true,
  },
  {
    href: "/painel/usuarios",
    label: "Usuários",
    icon: Users,
    adminOnly: true,
  },
  { href: "/painel/loja", label: "Loja", icon: Store },
  { href: "/painel/seguranca", label: "Segurança", icon: Shield },
  {
    href: "/painel/configuracoes",
    label: "Configurações",
    icon: Settings,
    adminOnly: true,
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isAdmin = useAuthStore((s) => s.isAdmin);

  return (
    <aside className="flex h-full w-64 flex-col border-r border-[var(--brand-nav-divider)] bg-beige">
      <div className="border-b border-[var(--brand-nav-divider)] px-5 py-5">
        <Link href="/" className="text-xl font-bold text-[#61005D]">
          Nkateko
        </Link>
        <p className="mt-1 text-xs text-taupe">Painel do mercado</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {links.map((link) => {
          if (link.adminOnly && !isAdmin()) return null;
          const active = link.exact
            ? pathname === link.href
            : pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-[#61005D] text-white"
                  : "text-charcoal hover:bg-white",
              )}
            >
              <Icon className="size-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--brand-nav-divider)] p-4">
        <p className="truncate text-sm font-medium text-charcoal">
          {user?.name}
        </p>
        <p className="truncate text-xs text-taupe">{user?.email}</p>
        <div className="mt-3 flex flex-col gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/">Ver mercado</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => {
              logout();
              router.push("/entrar");
            }}
          >
            <LogOut className="mr-2 size-4" />
            Sair
          </Button>
        </div>
      </div>
    </aside>
  );
}
