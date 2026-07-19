"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatBRL, formatDateTime } from "@/lib/format";
import type { DashboardOverview } from "@/lib/types";

export default function PainelOverviewPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);

  useEffect(() => {
    api<DashboardOverview>("/dashboard/overview")
      .then(setData)
      .catch((error) =>
        toast.error(
          error instanceof Error ? error.message : "Erro ao carregar painel",
        ),
      );
  }, []);

  if (!data) {
    return <p className="text-sm text-taupe">Carregando visão geral...</p>;
  }

  const cards = [
    { label: "Receita", value: formatBRL(data.kpis.revenueCents) },
    { label: "Pedidos", value: String(data.kpis.orderCount) },
    { label: "Pendentes", value: String(data.kpis.pendingOrders) },
    { label: "Produtos ativos", value: String(data.kpis.activeProducts) },
    { label: "Clientes", value: String(data.kpis.customerCount) },
    { label: "Estoque baixo", value: String(data.kpis.lowStock) },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal sm:text-3xl">
        Visão geral
      </h1>
      <p className="mt-1 text-sm text-taupe">
        Indicadores do mercado Nkateko.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-[12px] border border-border bg-beige p-5"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-taupe">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-[#61005D]">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Pedidos recentes</h2>
        <div className="mt-4 overflow-x-auto rounded-[12px] border border-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-beige text-taupe">
              <tr>
                <th className="px-4 py-3 font-medium">Pedido</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((order) => (
                <tr key={order.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{order.orderNumber}</td>
                  <td className="px-4 py-3">{order.user?.name ?? "—"}</td>
                  <td className="px-4 py-3">{formatBRL(order.totalCents)}</td>
                  <td className="px-4 py-3">{order.status}</td>
                  <td className="px-4 py-3 text-taupe">
                    {formatDateTime(order.createdAt)}
                  </td>
                </tr>
              ))}
              {data.recentOrders.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-taupe"
                  >
                    Nenhum pedido ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
