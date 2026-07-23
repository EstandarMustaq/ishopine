"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, LoadingState } from "@ishopine/ui";
import { api } from "@/lib/api";
import { formatMZN } from "@/lib/format";

type Plan = {
  code: string;
  name: string;
  description?: string | null;
  monthlyPriceCents: number;
  includedOrders: number | null;
  overageOrderCents: number;
  commissionBps: number | null;
};

export default function BackofficePricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Plan[]>("/pricing/plans")
      .then((p) => setPlans(Array.isArray(p) ? p : []))
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Erro ao carregar planos"),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 text-[var(--ds-text)]">
      <div>
        <h1 className="text-2xl font-semibold">Pricing</h1>
        <p className="mt-1 text-sm text-[var(--ds-text-secondary)]">
          Planos de plataforma (consumo + premium) — só leitura ops.
        </p>
      </div>
      {loading ? (
        <LoadingState label="A carregar planos" variant="skeleton" />
      ) : plans.length === 0 ? (
        <EmptyState
          title="Sem planos"
          description="Os planos configurados pela plataforma aparecerão aqui."
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--ds-radius-md)] border border-[var(--ds-border-subdued)] bg-[var(--ds-surface)] shadow-[var(--ds-shadow-raised)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-[var(--ds-bg)] text-[var(--ds-text-secondary)]">
              <tr>
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Mensal</th>
                <th className="px-4 py-3 font-medium">Pedidos</th>
                <th className="px-4 py-3 font-medium">Overage</th>
                <th className="px-4 py-3 font-medium">Commission</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr
                  key={p.code}
                  className="border-t border-[var(--ds-border-subdued)]"
                >
                  <td className="px-4 py-3 font-mono text-xs">{p.code}</td>
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatMZN(p.monthlyPriceCents)}
                  </td>
                  <td className="px-4 py-3">
                    {p.includedOrders == null ? "Sem limite" : p.includedOrders}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatMZN(p.overageOrderCents)}
                  </td>
                  <td className="px-4 py-3">
                    {p.commissionBps != null ? `${p.commissionBps / 100}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
