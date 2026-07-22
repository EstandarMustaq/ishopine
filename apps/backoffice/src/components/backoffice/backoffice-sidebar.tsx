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
  { href: "/", label: "Operabilidade", icon: LayoutDashboard, exact: true },
  { href: "/observability", label: "Observability", icon: Activity },
  { href: "/anuncios", label: "Anúncios", icon: Megaphone },
  { href: "/contabilidade", label: "Contabilidade", icon: Receipt },
  { href: "/pricing", label: "Pricing", icon: Tag },
  { href: "/feature-flags", label: "Flags", icon: Flag },
  { href: "/usuarios", label: "Utilizadores", icon: Users },
  { href: "/cupons", label: "Cupões", icon: Ticket },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
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
        "flex h-full flex-col border-r bg-[#1A1A1A] text-white",
        collapsed ? "w-[4.25rem]" : "w-56",
        className,
      )}
    >
      <div className="border-b border-white/10 px-3 py-4">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/ishopine-mark.svg" alt="" className="size-7 invert" />
          {!collapsed && (
            <span className="text-[13px] font-bold">
              backoffice
            </span>
          )}
        </Link>
        {!collapsed && (
          <p className="mt-1 text-[10px] text-white/50">
            EquipaiShopine · ops only
          </p>
        )}
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        {links.map((link) => {
          const active = link.exact
            ? pathname === "/"
            : pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium",
                collapsed && "justify-center",
                active
                  ? "bg-[var(--brand-orange)] text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="size-3.5" />
              {!collapsed && link.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex gap-1 border-t border-white/10 p-2">
        <Button variant="ghost" size="icon-sm" onClick={onToggle} className="text-white hover:bg-white/10">
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-white hover:bg-white/10"
          onClick={() => {
            logout();
            window.location.href = `${marketplaceUrl}/entrar`;
          }}
        >
          <LogOut />
        </Button>
      </div>
    </aside>
  );
}
