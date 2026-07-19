"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { AuthGate } from "@/components/dashboard/auth-gate";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <AuthGate roles={["ADMIN", "OPERATOR"]}>
      <div className="flex min-h-screen bg-white">
        <div className="hidden md:block">
          <DashboardSidebar />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3 border-b border-[var(--mavula-nav-divider)] px-4 py-3 md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Menu do painel</SheetTitle>
                </SheetHeader>
                <DashboardSidebar />
              </SheetContent>
            </Sheet>
            <span className="text-lg font-bold text-[#61005D]">Mavula</span>
          </div>
          <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
        </div>
      </div>
    </AuthGate>
  );
}
