"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatMZN, formatDateTime } from "@/lib/format";
import type { DashboardCharts, DashboardOverview } from "@/lib/types";

const gmvConfig = {
  gmv: { label: "GMV", color: "var(--chart-1)" },
} satisfies ChartConfig;

const ordersConfig = {
  orders: { label: "Pedidos", color: "var(--chart-2)" },
  count: { label: "Qtd", color: "var(--chart-3)" },
} satisfies ChartConfig;

export default function PainelOverviewPage() {
  const router = useRouter();
  const canAccessPainel = useAuthStore((s) => s.canAccessPainel);
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [charts, setCharts] = useState<DashboardCharts | null>(null);

  useEffect(() => {
    // Buyers opening the seller app should create a shop first.
    if (!canAccessPainel()) {
      router.replace("/loja");
    }
  }, [canAccessPainel, router]);

  useEffect(() => {
    if (!canAccessPainel()) return;
    api<DashboardOverview>("/dashboard/overview")
      .then(setData)
      .catch((error) =>
        toast.error(
          error instanceof Error ? error.message : "Erro ao carregar painel",
        ),
      );
    api<DashboardCharts>("/dashboard/charts")
      .then(setCharts)
      .catch(() => setCharts(null));
  }, [canAccessPainel]);

  const series = useMemo(
    () =>
      (charts?.series ?? []).map((row) => ({
        ...row,
        label: row.date.slice(5),
        gmv: row.gmvCents / 100,
      })),
    [charts],
  );

  if (!data) {
    return <p className="text-sm text-taupe">Carregando visão geral...</p>;
  }

  const k = data.kpis;
  const cards = [
    { label: "GMV", value: formatMZN(k.gmvCents ?? k.revenueCents ?? 0) },
    { label: "Lojas ativas", value: String(k.activeShops ?? k.shopCount ?? "—") },
    { label: "Vendedores", value: String(k.sellerCount ?? "—") },
    { label: "Pedidos", value: String(k.orderCount) },
    { label: "Pendentes", value: String(k.pendingOrders) },
    { label: "Produtos ativos", value: String(k.activeProducts) },
    { label: "Compradores", value: String(k.buyerCount ?? k.customerCount ?? 0) },
    { label: "Estoque baixo", value: String(k.lowStock) },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal sm:text-3xl">
        Visão geral
      </h1>
      <p className="mt-1 text-sm text-taupe">
        Indicadores do mercado iShopine.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-soft"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-taupe">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-[#111111]">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {charts && (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-soft">
            <h2 className="text-[15px] font-semibold text-zinc-900">
              GMV (30 dias)
            </h2>
            <ChartContainer config={gmvConfig} className="mt-4 h-56 w-full">
              <AreaChart data={series}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="gmv"
                  type="monotone"
                  fill="var(--color-gmv)"
                  fillOpacity={0.2}
                  stroke="var(--color-gmv)"
                />
              </AreaChart>
            </ChartContainer>
          </section>

          <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-soft">
            <h2 className="text-[15px] font-semibold text-zinc-900">
              Pedidos (30 dias)
            </h2>
            <ChartContainer config={ordersConfig} className="mt-4 h-56 w-full">
              <BarChart data={series}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="orders"
                  fill="var(--color-orders)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </section>

          <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-soft lg:col-span-2">
            <h2 className="text-[15px] font-semibold text-zinc-900">
              Pedidos por estado
            </h2>
            <ChartContainer
              config={ordersConfig}
              className="mt-4 h-56 w-full"
            >
              <BarChart data={charts.ordersByStatus} layout="vertical">
                <CartesianGrid horizontal={false} />
                <YAxis
                  dataKey="status"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
                <XAxis type="number" hide />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  name="count"
                  fill="var(--color-count)"
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ChartContainer>
            <div className="mt-3 flex flex-wrap gap-2">
              {charts.ordersByStatus.map((row) => (
                <span
                  key={row.status}
                  className="rounded-full bg-zinc-100 px-2.5 py-1 text-[12px] text-zinc-600"
                >
                  {row.status}: {row.count}
                </span>
              ))}
            </div>
          </section>
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Pedidos recentes</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-zinc-50 text-taupe">
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
                  <td className="px-4 py-3">
                    {order.buyer?.name ?? order.user?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">{formatMZN(order.totalCents)}</td>
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
