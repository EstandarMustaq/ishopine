"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

export const AFFILIATE_REF_KEY = "ishopine-ref";

export function getStoredAffiliateCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(AFFILIATE_REF_KEY);
  } catch {
    return null;
  }
}

/**
 * Captures ?ref= from the URL, tracks the click, stores the code for checkout.
 */
export function AffiliateRefCapture() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref) return;

    let cancelled = false;
    (async () => {
      try {
        window.localStorage.setItem(AFFILIATE_REF_KEY, ref);
        const result = await api<{ href?: string }>(
          `/affiliate/click/${encodeURIComponent(ref)}`,
          { method: "POST", token: null },
        );
        if (cancelled) return;
        const params = new URLSearchParams(searchParams.toString());
        params.delete("ref");
        const qs = params.toString();
        const target =
          result.href && result.href !== pathname
            ? result.href
            : `${pathname}${qs ? `?${qs}` : ""}`;
        router.replace(target);
      } catch {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("ref");
        const qs = params.toString();
        router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, pathname, router]);

  return null;
}
