"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useTenantStore, type TenantListItem } from "@/lib/tenant-store";
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
  roles,
  adminOnly,
  painelAccess,
  sellerAccess,
  staffAccess,
  affiliateAccess,
  allowWithout2fa,
}: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setUser = useAuthStore((s) => s.setUser);
  const canAccessPainel = useAuthStore((s) => s.canAccessPainel);
  const requiresTwoFactor = useAuthStore((s) => s.requiresTwoFactor);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const isStaff = useAuthStore((s) => s.isStaff);
  const setActiveTenant = useTenantStore((s) => s.setActiveTenant);
  const hydrateTenant = useTenantStore((s) => s.hydrate);
  const [ready, setReady] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      hydrateTenant();
      const handoff = consumeHandoffToken();
      let token = handoff;
      if (handoff) {
        try {
          const me = await api<User>("/auth/me", { token: handoff });
          if (cancelled) return;
          setAuth(handoff, me);
        } catch {
          window.location.href = `${marketplaceUrl}/entrar?next=seller`;
          return;
        }
      } else {
        token = useAuthStore.getState().accessToken;
        if (!token) {
          // Cookie SSO: try session without Bearer (credentials include cookie).
          try {
            const me = await api<User>("/auth/me", { token: null });
            if (cancelled) return;
            setAuth("", me);
            token = "";
          } catch {
            // stay unauthenticated
          }
        }
      }

      if (token !== null && token !== undefined) {
        try {
          const account = await api<{ tenants: TenantListItem[] }>(
            "/accounts/me",
            { token: token || null },
          );
          if (cancelled) return;
          const tenants = account.tenants ?? [];
          const current = useTenantStore.getState().activeTenantId;
          const stillValid = tenants.some((t) => t.tenant.id === current);
          if (!stillValid && tenants.length) {
            const store = tenants.find((t) => t.tenant.type === "STORE");
            setActiveTenant((store ?? tenants[0]).tenant.id);
          }
        } catch {
          // Tenant load is best-effort; pages may still work for non-tenant routes.
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
  }, [setAuth, setActiveTenant, hydrateTenant]);

  useEffect(() => {
    if (!ready || bootstrapping || !user) return;
    let cancelled = false;
    api<User>("/auth/me")
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ready, bootstrapping, user, setUser]);

  useEffect(() => {
    if (!ready || bootstrapping) return;
    if (!user) {
      window.location.href = `${marketplaceUrl}/entrar?next=seller`;
      return;
    }

    const role = user.platformRole ?? user.role;

    if (staffAccess && !isStaff()) {
      window.location.href = marketplaceUrl;
      return;
    }

    if (adminOnly && !isAdmin()) {
      router.replace("/");
      return;
    }

    if (roles && (!role || !roles.includes(role))) {
      window.location.href = marketplaceUrl;
      return;
    }

    // Seller app is the onboarding surface for first shop — any signed-in
    // user may enter. Do NOT require canSell (that flag is set only after
    // createShop succeeds).
    if (painelAccess && !sellerAccess && !canAccessPainel()) {
      window.location.href = `${marketplaceUrl}/conta`;
      return;
    }

    if (affiliateAccess && !user.affiliateEligible && !canAccessPainel()) {
      window.location.href = `${marketplaceUrl}/conta`;
      return;
    }

    const onSecurity =
      allowWithout2fa || pathname.startsWith("/seguranca");
    // Allow /loja without 2FA so first-time sellers can create a shop.
    const onShopOnboarding = pathname.startsWith("/loja");

    if (
      (painelAccess || sellerAccess) &&
      canAccessPainel() &&
      requiresTwoFactor() &&
      !user.totpEnabled &&
      !onSecurity &&
      !onShopOnboarding
    ) {
      router.replace("/seguranca?required=1");
    }
  }, [
    ready,
    bootstrapping,
    accessToken,
    user,
    roles,
    adminOnly,
    painelAccess,
    sellerAccess,
    staffAccess,
    affiliateAccess,
    allowWithout2fa,
    pathname,
    router,
    canAccessPainel,
    requiresTwoFactor,
    isAdmin,
    isStaff,
  ]);

  if (!ready || bootstrapping || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-taupe">
        Carregando...
      </div>
    );
  }

  const role = user.platformRole ?? user.role;
  if (staffAccess && !isStaff()) return null;
  if (adminOnly && !isAdmin()) return null;
  if (roles && (!role || !roles.includes(role))) return null;
  if (painelAccess && !sellerAccess && !canAccessPainel()) return null;

  const onSecurity =
    allowWithout2fa || pathname.startsWith("/seguranca");
  const onShopOnboarding = pathname.startsWith("/loja");
  if (
    (painelAccess || sellerAccess) &&
    canAccessPainel() &&
    requiresTwoFactor() &&
    !user.totpEnabled &&
    !onSecurity &&
    !onShopOnboarding
  ) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-taupe">
        Redirecionando para segurança...
      </div>
    );
  }

  return <>{children}</>;
}
