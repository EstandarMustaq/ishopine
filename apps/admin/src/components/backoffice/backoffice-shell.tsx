"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/dashboard/auth-gate";
import { BackofficeSidebar } from "@/components/backoffice/backoffice-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "ishopine-backoffice-sidebar-collapsed";

export function BackofficeShell({ children }: { children: React.ReactNode }) {
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

  return (
    <AuthGate staffAccess>
      <TooltipProvider delayDuration={200}>
        <div className="flex h-svh overflow-hidden bg-[var(--ds-bg)]">
          <div
            className={cn(
              "hidden h-full shrink-0 transition-[width] duration-200 md:block",
              ready && (collapsed ? "w-[4.25rem]" : "w-[var(--ds-sidebar-width)]"),
              !ready && "w-[var(--ds-sidebar-width)]",
            )}
          >
            <BackofficeSidebar
              collapsed={collapsed}
              onToggle={toggleCollapsed}
              className="h-full"
            />
          </div>
          <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex h-[var(--ds-topbar-height)] shrink-0 items-center gap-3 bg-[var(--ds-topbar)] px-4 text-white">
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                className="flex size-10 items-center justify-center rounded-[var(--ds-radius-sm)] hover:bg-white/10 md:hidden"
                aria-label="Menu"
              >
                ☰
              </button>
              <span className="text-[15px] font-semibold tracking-tight">
                iShopine Admin
              </span>
              <span className="ml-auto hidden text-[13px] text-white/70 sm:inline">
                Staff
              </span>
              <span className="flex size-8 items-center justify-center rounded-full bg-[var(--ds-brand)] text-[12px] font-semibold">
                IS
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {children}
            </div>
          </div>
          {mobileOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-20 bg-black/30 md:hidden"
                aria-label="Fechar menu"
                onClick={() => setMobileOpen(false)}
              />
              <div className="fixed inset-y-0 left-0 z-30 w-[var(--ds-sidebar-width)] md:hidden">
                <BackofficeSidebar
                  collapsed={false}
                  onToggle={() => setMobileOpen(false)}
                  className="h-full shadow-lg"
                />
              </div>
            </>
          )}
        </div>
      </TooltipProvider>
    </AuthGate>
  );
}
