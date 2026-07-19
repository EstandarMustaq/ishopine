"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AUTH_STORAGE_KEY } from "@/lib/api";
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
  /** Platform staff (admin or operator) */
  isStaff: () => boolean;
  isAdmin: () => boolean;
  /** Sellers, shop members (canSell), or platform staff */
  canAccessPainel: () => boolean;
  /** Staff/sellers must enable 2FA for painel routes */
  requiresTwoFactor: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      setAuth: (accessToken, user) => set({ accessToken, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ accessToken: null, user: null }),
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

export function postLoginPath(user: User): string {
  const role = user.platformRole ?? user.role;
  const canSell =
    Boolean(user.canSell) ||
    role === "SELLER" ||
    role === "PLATFORM_ADMIN" ||
    role === "PLATFORM_OPERATOR";

  if (canSell) {
    if (!user.totpEnabled) return "/painel/seguranca?required=1";
    return "/painel";
  }
  return "/conta";
}
