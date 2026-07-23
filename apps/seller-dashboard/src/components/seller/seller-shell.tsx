"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/dashboard/auth-gate";
import { SellerSidebar } from "@/components/seller/seller-sidebar";
import { TenantSwitcher } from "@/components/seller/tenant-switcher";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useTenantStore } from "@/lib/tenant-store";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "ishopine-seller-sidebar-collapsed";

export function SellerShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const hydrate = useTenantStore((s) => s.hydrate);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "1") setCollapsed(true);
    hydrate();
    setReady(true);
  }, [hydrate]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <AuthGate sellerAccess>
      <TooltipProvider delayDuration={200}>
        <div className="flex h-svh overflow-hidden bg-[var(--ds-bg)]">
          <div
            className={cn(
              "hidden h-full shrink-0 transition-[width] duration-200 md:block",
              ready && (collapsed ? "w-[4.25rem]" : "w-[var(--ds-sidebar-width)]"),
              !ready && "w-[var(--ds-sidebar-width)]",
            )}
          >
            <SellerSidebar
              collapsed={collapsed}
              onToggle={toggleCollapsed}
              className="h-full"
            />
          </div>

          <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex h-[var(--ds-topbar-height)] shrink-0 items-center gap-3 bg-[var(--ds-topbar)] px-4">
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                className="flex size-10 items-center justify-center rounded-[var(--ds-radius-sm)] text-white hover:bg-white/10 md:hidden"
                aria-label="Menu"
              >
                ☰
              </button>
              <div className="min-w-0 flex-1 [&_*]:text-white">
                <TenantSwitcher />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {children}
            </div>
          </div>

          {mobileOpen && (
            <button
              type="button"
              aria-label="Fechar menu"
              className="fixed inset-0 z-20 bg-black/30 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
          )}
          <div
            className={cn(
              "fixed inset-y-0 left-0 z-30 h-svh w-56 transition-transform duration-200 md:hidden",
              mobileOpen ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <SellerSidebar
              collapsed={false}
              onToggle={() => setMobileOpen(false)}
              className="h-full shadow-lg"
            />
          </div>
        </div>
      </TooltipProvider>
    </AuthGate>
  );
}
