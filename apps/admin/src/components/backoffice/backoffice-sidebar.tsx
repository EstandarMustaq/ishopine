"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Receipt,
  Settings,
  Tag,
  Ticket,
  Users,
  Flag,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/observability", label: "Observability", icon: Activity },
  { href: "/anuncios", label: "Anúncios", icon: Megaphone },
  { href: "/contabilidade", label: "Contabilidade", icon: Receipt },
  { href: "/pricing", label: "Pricing", icon: Tag },
  { href: "/feature-flags", label: "Flags", icon: Flag },
  { href: "/usuarios", label: "Utilizadores", icon: Users },
  { href: "/cupons", label: "Cupões", icon: Ticket },
  { href: "/configuracoes", label: "Definições", icon: Settings },
];

export function BackofficeSidebar({
  collapsed,
  onToggle,
  className,
}: {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const logout = useAuthStore((s) => s.logout);
  const marketplaceUrl =
    process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3000";

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-[var(--ds-sidebar)] text-[var(--ds-sidebar-text)]",
        collapsed ? "w-[4.25rem]" : "w-[var(--ds-sidebar-width)]",
        className,
      )}
    >
      <div className={cn("border-b border-white/10 px-3 py-4", collapsed && "px-2")}>
        <Link href="/" className="flex items-center gap-2">
          <span className="text-[15px] font-semibold tracking-tight text-white">
            {collapsed ? "iS" : "iShopine"}
          </span>
          {!collapsed ? (
            <span className="text-[12px] text-[var(--ds-sidebar-muted)]">Admin</span>
          ) : null}
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {links.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-[var(--ds-radius-sm)] px-3 py-2 text-[14px] transition-colors",
                active
                  ? "bg-[var(--ds-sidebar-active)] font-medium text-white"
                  : "text-[var(--ds-sidebar-muted)] hover:bg-white/10 hover:text-white",
                collapsed && "justify-center px-2",
              )}
              title={item.label}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed ? <span>{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-1 border-t border-white/10 p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label="Recolher"
          className="text-[var(--ds-sidebar-muted)] hover:bg-white/10 hover:text-white"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </Button>
        {!collapsed ? (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-[var(--ds-sidebar-muted)] hover:bg-white/10 hover:text-white"
            onClick={() => {
              logout();
              window.location.href = `${marketplaceUrl}/entrar?next=backoffice`;
            }}
          >
            <LogOut className="size-4" />
          </Button>
        ) : null}
      </div>
    </aside>
  );
}
