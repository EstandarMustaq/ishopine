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
        <div className="flex h-svh overflow-hidden bg-[var(--brand-surface)]">
          <div
            className={cn(
              "hidden h-full shrink-0 transition-[width] duration-200 md:block",
              ready && (collapsed ? "w-[4.25rem]" : "w-56"),
              !ready && "w-56",
            )}
          >
            <BackofficeSidebar
              collapsed={collapsed}
              onToggle={toggleCollapsed}
              className="h-full"
            />
          </div>
          <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center border-b border-[var(--brand-border)] bg-white px-4 py-3 md:hidden">
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                className="rounded-xl border px-3 py-1.5 text-sm"
              >
                Menu
              </button>
              <span className="ml-3 text-sm font-semibold">Backoffice</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
              {children}
            </div>
          </div>
          {mobileOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-20 bg-black/30 md:hidden"
                onClick={() => setMobileOpen(false)}
              />
              <div className="fixed inset-y-0 left-0 z-30 w-56 md:hidden">
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
