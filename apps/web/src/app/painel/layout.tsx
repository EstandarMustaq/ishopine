"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/dashboard/auth-gate";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "ishopine-painel-sidebar-collapsed";

export default function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "1") setCollapsed(true);
    setReady(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  function toggleMobile() {
    setMobileOpen((prev) => !prev);
  }

  return (
    <AuthGate painelAccess>
      <TooltipProvider delayDuration={200}>
        <div className="flex h-svh overflow-hidden bg-transparent">
          <div
            className={cn(
              "hidden h-full shrink-0 transition-[width] duration-200 md:block",
              ready && (collapsed ? "w-[4.25rem]" : "w-56"),
              !ready && "w-56",
            )}
          >
            <DashboardSidebar
              collapsed={collapsed}
              onToggle={toggleCollapsed}
              className="h-full"
            />
          </div>

          <div className="flex h-full min-w-0 flex-1">
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <div className="flex shrink-0 items-center gap-3 border-b border-zinc-200/60 bg-white/60 px-4 py-2.5 backdrop-blur-xl md:hidden">
                <button
                  type="button"
                  onClick={toggleMobile}
                  className="flex size-8 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700"
                  aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
                >
                  {mobileOpen ? (
                    <span className="text-sm font-semibold">‹</span>
                  ) : (
                    <span className="text-sm font-semibold">›</span>
                  )}
                </button>
                <span className="text-[15px] font-semibold tracking-tight text-zinc-900">
                  iShopine
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                {children}
              </div>
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
            <DashboardSidebar
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
