"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Gift,
  LayoutDashboard,
  LogOut,
  Megaphone,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
    href: "/painel/anuncios",
    label: "Anúncios",
    icon: Megaphone,
    adminOnly: true,
  },
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
  { href: "/painel/recompensas", label: "Recompensas", icon: Gift },
  { href: "/painel/seguranca", label: "Segurança", icon: Shield },
  {
    href: "/painel/configuracoes",
    label: "Configurações",
    icon: Settings,
    adminOnly: true,
  },
];

export function DashboardSidebar({
  collapsed,
  onToggle,
  className,
}: {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const initials =
    user?.name
      ?.split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "IS";

  return (
    <aside
      className={cn(
        "relative flex h-full min-h-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        collapsed ? "w-[4.25rem]" : "w-56",
        className,
      )}
    >
      <div
        className={cn(
          "shrink-0 border-b border-sidebar-border px-3 py-4",
          collapsed && "px-2",
        )}
      >
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2",
            collapsed && "justify-center",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/ishopine-mark.svg"
            alt=""
            className={cn(collapsed ? "size-7" : "size-8")}
          />
          {!collapsed && (
            <span className="text-[15px] font-bold tracking-tight">
              <span className="text-[var(--ds-brand)]">i</span>
              <span className="text-[var(--brand-charcoal)]">Shopine</span>
            </span>
          )}
        </Link>
        {!collapsed && (
          <p className="mt-1.5 text-[11px] text-zinc-500">Painel do mercado</p>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2">
        <div className="flex flex-col gap-0.5">
          {links.map((link) => {
            if (link.adminOnly && !isAdmin()) return null;
            const active = link.exact
              ? pathname === link.href
              : pathname.startsWith(link.href);
            const Icon = link.icon;
            const item = (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors duration-200",
                  collapsed && "justify-center px-2",
                  active
                    ? "bg-[var(--ds-brand)] text-white shadow-soft"
                    : "text-zinc-600 hover:bg-[rgba(0,128,96,0.1)] hover:text-[var(--brand-charcoal)]",
                )}
              >
                <Icon className="size-3.5 shrink-0 opacity-80" />
                {!collapsed && <span className="truncate">{link.label}</span>}
              </Link>
            );
            if (!collapsed) return item;
            return (
              <Tooltip key={link.href}>
                <TooltipTrigger asChild>{item}</TooltipTrigger>
                <TooltipContent side="right">{link.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        <div
          className={cn(
            "flex items-center gap-2",
            collapsed && "justify-center",
          )}
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-zinc-200 text-[11px] font-semibold text-zinc-700">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-zinc-900">
                {user?.name}
              </p>
              <p className="truncate text-[11px] text-zinc-500">{user?.email}</p>
            </div>
          )}
        </div>
        <div
          className={cn(
            "mt-2.5 flex flex-col gap-1.5",
            collapsed && "items-center",
          )}
        >
          {!collapsed && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/">Ver mercado</Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size={collapsed ? "icon-sm" : "sm"}
            className={cn(!collapsed && "justify-start")}
            onClick={() => {
              logout();
              router.push("/entrar");
            }}
          >
            <LogOut className={cn("size-3.5", !collapsed && "mr-2")} />
            {!collapsed && "Sair"}
          </Button>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? "Expandir menu" : "Colapsar menu"}
        className="absolute top-1/2 -right-3 z-20 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-900"
      >
        {collapsed ? (
          <ChevronRight className="size-3.5" />
        ) : (
          <ChevronLeft className="size-3.5" />
        )}
      </button>
    </aside>
  );
}
