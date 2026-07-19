"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Boxes,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  Settings,
  Shield,
  ShoppingBag,
  Store,
  Ticket,
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
  { href: "/painel/billing", label: "Pagamentos", icon: CreditCard },
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
  {
    href: "/painel/cupons",
    label: "Cupons",
    icon: Ticket,
    adminOnly: true,
  },
  {
    href: "/painel/disputas",
    label: "Disputas",
    icon: AlertTriangle,
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
    <aside className="flex h-full w-56 flex-col border-r border-zinc-200/60 bg-zinc-50/80 backdrop-blur-xl">
      <div className="border-b border-zinc-200/60 px-4 py-4">
        <Link
          href="/"
          className="text-[15px] font-semibold tracking-tight text-zinc-900"
        >
          iShopine
        </Link>
        <p className="mt-0.5 text-[11px] text-zinc-500">Painel do mercado</p>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-2">
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
                "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors duration-200",
                active
                  ? "bg-zinc-900 text-white shadow-soft"
                  : "text-zinc-600 hover:bg-white/80 hover:text-zinc-900",
              )}
            >
              <Icon className="size-3.5 shrink-0 opacity-80" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-200/60 p-3">
        <p className="truncate text-[13px] font-medium text-zinc-900">
          {user?.name}
        </p>
        <p className="truncate text-[11px] text-zinc-500">{user?.email}</p>
        <div className="mt-2.5 flex flex-col gap-1.5">
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
            <LogOut className="mr-2 size-3.5" />
            Sair
          </Button>
        </div>
      </div>
    </aside>
  );
}
