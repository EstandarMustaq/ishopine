"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AUTH_STORAGE_KEY } from "@/lib/api";
import { appHandoffUrl, getAppUrls } from "@/lib/app-urls";
import type { PlatformRole, User } from "@/lib/types";

function resolveRole(user: User | null): PlatformRole | null {
  if (!user) return null;
  return user.platformRole ?? user.role ?? null;
}

interface AuthState {
  accessToken: string | null;
  user: User | null;
  setAuth: (accessToken: string, user: User) => void;
  setUser: (user: User) => void;
  logout: () => void;

  isStaff: () => boolean;
  isAdmin: () => boolean;

  canAccessPainel: () => boolean;

  requiresTwoFactor: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      setAuth: (accessToken, user) => set({ accessToken, user }),
      setUser: (user) => set({ user }),
      logout: () => {
        // Clear HttpOnly SSO cookie (best-effort); local state always cleared.
        void fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/auth/logout`, {
          method: "POST",
          credentials: "include",
        }).catch(() => {});
        set({ accessToken: null, user: null });
      },
      isStaff: () => {
        const role = resolveRole(get().user);
        return (
          role === "PLATFORM_ADMIN" || role === "PLATFORM_OPERATOR"
        );
      },
      isAdmin: () => resolveRole(get().user) === "PLATFORM_ADMIN",
      canAccessPainel: () => {
        const user = get().user;
        if (!user) return false;
        const role = resolveRole(user);
        if (
          role === "PLATFORM_ADMIN" ||
          role === "PLATFORM_OPERATOR" ||
          role === "SELLER"
        ) {
          return true;
        }
        return Boolean(user.canSell);
      },
      requiresTwoFactor: () => get().canAccessPainel(),
    }),
    {
      name: AUTH_STORAGE_KEY,
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
      }),
    },
  ),
);

export type PostLoginResult =
  | { kind: "internal"; path: string }
  | { kind: "external"; href: string };

/**
 * Resolve where to send the user after login.
 * Seller / backoffice / affiliate live on separate origins — hand off via ?token=.
 */
export function resolvePostLogin(
  user: User,
  accessToken: string,
  next?: string | null,
): PostLoginResult {
  const role = user.platformRole ?? user.role;
  const isStaff =
    role === "PLATFORM_ADMIN" || role === "PLATFORM_OPERATOR";
  const canSell =
    Boolean(user.canSell) || role === "SELLER" || isStaff;

  if (next === "customer") {
    return {
      kind: "external",
      href: appHandoffUrl("customer", accessToken, "/"),
    };
  }
  if (next === "affiliate") {
    return {
      kind: "external",
      href: appHandoffUrl("affiliate", accessToken, "/"),
    };
  }
  if (next === "backoffice") {
    return {
      kind: "external",
      href: appHandoffUrl("backoffice", accessToken, "/"),
    };
  }
  if (next === "seller") {
    // First-time sellers land on /loja to create a shop (canSell is false yet).
    // Existing sellers without 2FA go to security setup.
    const canSell =
      Boolean(user.canSell) ||
      role === "SELLER" ||
      isStaff;
    const path =
      canSell && !user.totpEnabled ? "/seguranca?required=1" : "/loja";
    return {
      kind: "external",
      href: appHandoffUrl("seller", accessToken, path),
    };
  }

  if (isStaff) {
    return {
      kind: "external",
      href: appHandoffUrl("backoffice", accessToken, "/"),
    };
  }

  if (canSell) {
    const path = user.totpEnabled ? "/loja" : "/seguranca?required=1";
    return {
      kind: "external",
      href: appHandoffUrl("seller", accessToken, path),
    };
  }

  return { kind: "internal", path: "/conta" };
}

/** Fallback path string (may be absolute for other apps). Prefer resolvePostLogin. */
export function postLoginPath(user: User): string {
  const role = user.platformRole ?? user.role;
  const isStaff =
    role === "PLATFORM_ADMIN" || role === "PLATFORM_OPERATOR";
  if (isStaff) return getAppUrls().backoffice;
  const canSell = Boolean(user.canSell) || role === "SELLER";
  if (canSell) return getAppUrls().seller;
  return "/conta";
}

export function navigatePostLogin(
  result: PostLoginResult,
  routerPush: (path: string) => void,
) {
  if (result.kind === "external") {
    window.location.href = result.href;
    return;
  }
  routerPush(result.path);
}
