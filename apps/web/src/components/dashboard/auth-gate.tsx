"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { PlatformRole, User } from "@/lib/types";

interface AuthGateProps {
  children: React.ReactNode;
  roles?: PlatformRole[];
  adminOnly?: boolean;

  painelAccess?: boolean;

  allowWithout2fa?: boolean;
}

export function AuthGate({
  children,
  roles,
  adminOnly,
  painelAccess,
  allowWithout2fa,
}: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const canAccessPainel = useAuthStore((s) => s.canAccessPainel);
  const requiresTwoFactor = useAuthStore((s) => s.requiresTwoFactor);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    // Refresh user via Bearer and/or SSO cookie.
    api<User>("/auth/me", { token: accessToken || null })
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
      });
    return () => {
      cancelled = true;
    };
  }, [ready, accessToken, setUser]);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/entrar");
      return;
    }

    const role = user.platformRole ?? user.role;

    if (adminOnly && !isAdmin()) {
      router.replace("/painel");
      return;
    }

    if (roles && (!role || !roles.includes(role))) {
      router.replace("/");
      return;
    }

    if (painelAccess && !canAccessPainel()) {
      router.replace("/conta");
      return;
    }

    const onSecurity =
      allowWithout2fa || pathname.startsWith("/painel/seguranca");

    if (
      painelAccess &&
      requiresTwoFactor() &&
      !user.totpEnabled &&
      !onSecurity
    ) {
      router.replace("/painel/seguranca?required=1");
    }
  }, [
    ready,
    accessToken,
    user,
    roles,
    adminOnly,
    painelAccess,
    allowWithout2fa,
    pathname,
    router,
    canAccessPainel,
    requiresTwoFactor,
    isAdmin,
  ]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-taupe">
        Carregando...
      </div>
    );
  }

  const role = user.platformRole ?? user.role;

  if (adminOnly && !isAdmin()) return null;
  if (roles && (!role || !roles.includes(role))) return null;
  if (painelAccess && !canAccessPainel()) return null;

  const onSecurity =
    allowWithout2fa || pathname.startsWith("/painel/seguranca");
  if (
    painelAccess &&
    requiresTwoFactor() &&
    !user.totpEnabled &&
    !onSecurity
  ) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-taupe">
        Redirecionando para segurança...
      </div>
    );
  }

  return <>{children}</>;
}
