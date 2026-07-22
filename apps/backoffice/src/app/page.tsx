"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatMZN } from "@/lib/format";
import type { DashboardCharts, DashboardOverview } from "@/lib/types";

export default function BackofficeHomePage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [charts, setCharts] = useState<DashboardCharts | null>(null);

  useEffect(() => {
    api<DashboardOverview>("/dashboard/overview")
      .then(setData)
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Erro ao carregar"),
      );
    api<DashboardCharts>("/dashboard/charts")
      .then(setCharts)
      .catch(() => setCharts(null));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--brand-charcoal)]">
        Operabilidade
      </h1>
      <p className="mt-1 text-sm text-[var(--brand-taupe)]">
        Métricas da plataforma — acesso exclusivo equipa iShopine.
      </p>

      {!data ? (
        <p className="mt-8 text-sm text-taupe">Carregando…</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "GMV",
              value: formatMZN(data.kpis.gmvCents ?? 0),
            },
            {
              label: "Pedidos",
              value: String(data.kpis.orderCount),
            },
            {
              label: "Lojas activas",
              value: String(data.kpis.activeShops ?? 0),
            },
            {
              label: "Produtos activos",
              value: String(data.kpis.activeProducts),
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border bg-white p-5 shadow-soft"
            >
              <p className="text-xs uppercase tracking-wide text-taupe">
                {card.label}
              </p>
              <p className="mt-2 text-2xl font-bold">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {charts && (
        <p className="mt-8 text-sm text-taupe">
          Série 30 dias: {charts.series.length} pontos · estados de pedido:{" "}
          {charts.ordersByStatus.length}
        </p>
      )}
    </div>
  );
}
