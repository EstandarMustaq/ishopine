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
    <AuthGate painelAccess>
      <div className="flex min-h-screen bg-transparent">
        <div className="hidden md:block">
          <DashboardSidebar />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3 border-b border-zinc-200/60 bg-white/60 px-4 py-2.5 backdrop-blur-xl md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-56 border-r border-zinc-200/60 bg-zinc-50/90 p-0 backdrop-blur-xl">
                <SheetHeader className="sr-only">
                  <SheetTitle>Menu do painel</SheetTitle>
                </SheetHeader>
                <DashboardSidebar />
              </SheetContent>
            </Sheet>
            <span className="text-[15px] font-semibold tracking-tight text-zinc-900">
              iShopine
            </span>
          </div>
          <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
        </div>
      </div>
    </AuthGate>
  );
}
