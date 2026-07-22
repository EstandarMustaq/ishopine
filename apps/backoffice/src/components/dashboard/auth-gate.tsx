"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { PlatformRole, User } from "@/lib/types";

const marketplaceUrl =
  process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3000";

interface AuthGateProps {
  children: React.ReactNode;
  roles?: PlatformRole[];
  adminOnly?: boolean;
  painelAccess?: boolean;
  sellerAccess?: boolean;
  staffAccess?: boolean;
  affiliateAccess?: boolean;
  allowWithout2fa?: boolean;
}

function consumeHandoffToken(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const handoff = params.get("token");
  if (!handoff) return null;
  params.delete("token");
  const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
  window.history.replaceState({}, "", clean);
  return handoff;
}

export function AuthGate({
  children,
  staffAccess,
  adminOnly,
}: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setUser = useAuthStore((s) => s.setUser);
  const isStaff = useAuthStore((s) => s.isStaff);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const [ready, setReady] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [staffOk, setStaffOk] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const handoff = consumeHandoffToken();
      if (handoff) {
        try {
          const me = await api<User>("/auth/me", { token: handoff });
          if (cancelled) return;
          setAuth(handoff, me);
        } catch {
          window.location.href = `${marketplaceUrl}/entrar?next=backoffice`;
          return;
        }
      }
      if (!cancelled) {
        setBootstrapping(false);
        setReady(true);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [setAuth]);

  useEffect(() => {
    if (!ready || bootstrapping || !accessToken) return;
    let cancelled = false;
    Promise.all([
      api<User>("/auth/me"),
      api<{ platformStaffRole: string | null }>("/accounts/me").catch(() => ({
        platformStaffRole: null,
      })),
    ])
      .then(([me, account]) => {
        if (cancelled) return;
        setUser(me);
        setStaffOk(
          Boolean(account.platformStaffRole) ||
            me.platformRole === "PLATFORM_ADMIN" ||
            me.platformRole === "PLATFORM_OPERATOR",
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ready, bootstrapping, accessToken, setUser]);

  useEffect(() => {
    if (!ready || bootstrapping) return;
    if (!accessToken || !user) {
      window.location.href = `${marketplaceUrl}/entrar?next=backoffice`;
      return;
    }
    if (staffAccess && !staffOk && !isStaff()) {
      window.location.href = marketplaceUrl;
    }
    if (adminOnly && !isAdmin()) {
      router.replace("/");
    }
  }, [
    ready,
    bootstrapping,
    accessToken,
    user,
    staffAccess,
    staffOk,
    adminOnly,
    isStaff,
    isAdmin,
    router,
    pathname,
  ]);

  if (!ready || bootstrapping || !accessToken || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1A1A1A] text-sm text-white/60">
        Carregando backoffice...
      </div>
    );
  }

  if (staffAccess && !staffOk && !isStaff()) return null;

  return <>{children}</>;
}
