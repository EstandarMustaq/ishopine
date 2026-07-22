"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function HorizontalCatalog({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 pt-1 snap-x snap-mandatory scrollbar-thin sm:-mx-0 sm:px-0",
        "[scrollbar-width:thin]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function HorizontalCatalogItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-[148px] shrink-0 snap-start sm:w-[168px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
