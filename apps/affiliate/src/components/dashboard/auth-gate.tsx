"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { User } from "@/lib/types";

const marketplaceUrl =
  process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3000";

interface AuthGateProps {
  children: React.ReactNode;
  affiliateAccess?: boolean;
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

export function AuthGate({ children, affiliateAccess }: AuthGateProps) {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setUser = useAuthStore((s) => s.setUser);
  const canAccessPainel = useAuthStore((s) => s.canAccessPainel);
  const [ready, setReady] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

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
          window.location.href = `${marketplaceUrl}/entrar?next=affiliate`;
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
    api<User>("/auth/me")
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ready, bootstrapping, accessToken, setUser]);

  useEffect(() => {
    if (!ready || bootstrapping) return;
    if (!accessToken || !user) {
      window.location.href = `${marketplaceUrl}/entrar?next=affiliate`;
      return;
    }
    if (
      affiliateAccess &&
      !user.affiliateEligible &&
      !canAccessPainel()
    ) {
      window.location.href = `${marketplaceUrl}/conta`;
    }
  }, [
    ready,
    bootstrapping,
    accessToken,
    user,
    affiliateAccess,
    canAccessPainel,
  ]);

  if (!ready || bootstrapping || !accessToken || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--brand-muted)]">
        Carregando...
      </div>
    );
  }

  return <>{children}</>;
}
