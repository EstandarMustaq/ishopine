"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import {
  useTenantStore,
  type TenantListItem,
} from "@/lib/tenant-store";
import { cn } from "@/lib/utils";

export function TenantSwitcher() {
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const setActiveTenant = useTenantStore((s) => s.setActiveTenant);
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api<{
        tenants: TenantListItem[];
      }>("/accounts/me");
      setTenants(data.tenants ?? []);
      if (!activeTenantId && data.tenants?.length) {
        const store = data.tenants.find((t) => t.tenant.type === "STORE");
        setActiveTenant((store ?? data.tenants[0]).tenant.id);
      }
    } catch {
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, [activeTenantId, setActiveTenant]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <p className="text-[12px] text-[var(--brand-taupe)]">A carregar tenants…</p>
    );
  }

  if (tenants.length === 0) {
    return (
      <p className="text-[12px] text-[var(--brand-taupe)]">
        Sem tenants de venda. Crie um particular ou loja.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--brand-taupe)]">
        contexto
      </span>
      {tenants.map((item) => {
        const t = item.tenant;
        const active = t.id === activeTenantId;
        const Icon = t.type === "STORE" ? Building2 : UserRound;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTenant(t.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
              active
                ? "border-[var(--brand-orange)] bg-[var(--brand-orange)] text-white"
                : "border-[var(--brand-border)] bg-white text-[var(--brand-charcoal)] hover:border-[var(--brand-orange)]",
            )}
          >
            <Icon className="size-3.5" />
            <span className="max-w-[10rem] truncate">{t.name}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] uppercase",
                active ? "bg-white/20" : "bg-[var(--brand-surface)] text-[var(--brand-taupe)]",
              )}
            >
              {t.type === "STORE" ? "loja" : "particular"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
