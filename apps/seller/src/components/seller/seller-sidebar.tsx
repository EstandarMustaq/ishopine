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
  Package,
  Shield,
  ShoppingBag,
  Store,
  Wallet,
  Code2,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useTenantStore } from "@/lib/tenant-store";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const storeLinks = [
  { href: "/", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/pedidos", label: "Pedidos", icon: ShoppingBag },
  { href: "/produtos", label: "Produtos", icon: Package },
  { href: "/estoque", label: "Estoque", icon: Boxes },
  { href: "/billing", label: "Pagamentos", icon: CreditCard },
  { href: "/carteira", label: "Carteira", icon: Wallet },
  { href: "/desenvolvedores", label: "API", icon: Code2 },
  { href: "/disputas", label: "Disputas", icon: AlertTriangle },
  { href: "/loja", label: "Loja", icon: Store, storeOnly: true },
  { href: "/recompensas", label: "Recompensas", icon: Gift },
  { href: "/seguranca", label: "Segurança", icon: Shield },
] as const;

export function SellerSidebar({
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
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const marketplaceUrl =
    process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3000";

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
        "relative flex h-full min-h-0 flex-col border-r border-sidebar-border bg-white text-sidebar-foreground",
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
          className={cn("flex items-center gap-2", collapsed && "justify-center")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/ishopine-mark.svg"
            alt=""
            className={cn(collapsed ? "size-7" : "size-8")}
          />
          {!collapsed && (
            <span className="text-[15px] font-bold tracking-tight">
              <span className="text-[var(--brand-orange)]">i</span>
              <span className="text-[var(--brand-charcoal)]">Shopine</span>
              <span className="ml-1 text-[11px] font-semibold text-[var(--brand-taupe)]">
                seller
              </span>
            </span>
          )}
        </Link>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="flex flex-col gap-0.5">
          {storeLinks.map((link) => {
            if ("storeOnly" in link && link.storeOnly) {
              // Loja settings only meaningful for STORE — still show; API scopes by tenant
            }
            const exact = "exact" in link && Boolean(link.exact);
            const active = exact
              ? pathname === link.href
              : pathname.startsWith(link.href) && link.href !== "/";
            const isActive = exact ? pathname === "/" : active;
            const Icon = link.icon;
            const item = (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                  collapsed && "justify-center px-2",
                  isActive
                    ? "bg-[var(--brand-orange)] text-white shadow-soft"
                    : "text-zinc-600 hover:bg-[var(--brand-orange-soft)] hover:text-[var(--brand-charcoal)]",
                )}
              >
                <Icon className="size-3.5 shrink-0 opacity-80" />
                {!collapsed && <span className="truncate">{link.label}</span>}
              </Link>
            );
            if (collapsed) {
              return (
                <Tooltip key={link.href}>
                  <TooltipTrigger asChild>{item}</TooltipTrigger>
                  <TooltipContent side="right">{link.label}</TooltipContent>
                </Tooltip>
              );
            }
            return item;
          })}
        </div>
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-2">
        {!collapsed && (
          <p className="mb-2 truncate px-2 text-[10px] text-zinc-400">
            tenant: {activeTenantId ? activeTenantId.slice(0, 8) + "…" : "—"}
          </p>
        )}
        <div
          className={cn(
            "mb-2 flex items-center gap-2 rounded-lg px-2 py-2",
            collapsed && "justify-center",
          )}
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-[var(--brand-orange-soft)] text-[11px] font-semibold text-[var(--brand-orange)]">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold">{user?.name}</p>
              <a
                href={marketplaceUrl}
                className="text-[11px] text-[var(--brand-orange)] hover:underline"
              >
                Ver mercado
              </a>
            </div>
          )}
        </div>
        <div className={cn("flex gap-1", collapsed && "flex-col items-center")}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggle}
            aria-label={collapsed ? "Expandir" : "Recolher"}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              logout();
              router.push(
                `${marketplaceUrl}/entrar`,
              );
            }}
            aria-label="Sair"
          >
            <LogOut />
          </Button>
        </div>
      </div>
    </aside>
  );
}
