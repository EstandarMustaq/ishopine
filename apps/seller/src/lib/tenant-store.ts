"use client";

import { create } from "zustand";

export const TENANT_STORAGE_KEY = "ishopine-active-tenant";

export type TenantSummary = {
  id: string;
  type: "PARTICULAR" | "STORE";
  name: string;
  slug: string;
  shopId?: string | null;
};

export type TenantListItem = {
  membershipId: string;
  role: string;
  tenant: TenantSummary;
};

interface TenantState {
  activeTenantId: string | null;
  hydrate: () => void;
  setActiveTenant: (tenantId: string | null) => void;
}

export const useTenantStore = create<TenantState>((set) => ({
  activeTenantId: null,
  hydrate: () => {
    if (typeof window === "undefined") return;
    set({
      activeTenantId: window.localStorage.getItem(TENANT_STORAGE_KEY),
    });
  },
  setActiveTenant: (tenantId) => {
    if (typeof window !== "undefined") {
      if (tenantId) window.localStorage.setItem(TENANT_STORAGE_KEY, tenantId);
      else window.localStorage.removeItem(TENANT_STORAGE_KEY);
    }
    set({ activeTenantId: tenantId });
  },
}));

export function getActiveTenantId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TENANT_STORAGE_KEY);
}
