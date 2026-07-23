"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader, Card, Button } from "@ishopine/ui";
import { api } from "@/lib/api";
import { formatMZN, formatDateTime } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";

const statuses: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

export default function PedidoDetailPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);

  const load = useCallback(async () => {
    if (!params.id) return;
    try {
      setOrder(await api<Order>(`/orders/${params.id}`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(status: OrderStatus) {
    if (!order) return;
    try {
      await api(`/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      toast.success("Estado atualizado");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  if (!order) {
    return <p className="text-[14px] text-[var(--ds-text-secondary)]">A carregar…</p>;
  }

  return (
    <div>
      <PageHeader
        title={order.orderNumber}
        description={`${order.status} · ${formatDateTime(order.createdAt)}`}
        actions={
          <Link href="/pedidos" className="text-[14px] text-[var(--ds-interactive)]">
            ← Pedidos
          </Link>
        }
      />
      <Card>
        <p className="text-[14px]">
          Cliente: {order.user?.name || order.buyer?.name || "—"} (
          {order.user?.email || order.buyer?.email || "—"})
        </p>
        <p className="mt-2 text-[18px] font-bold">{formatMZN(order.totalCents)}</p>
        <ul className="mt-4 space-y-1 border-t border-[var(--ds-border-subdued)] pt-4 text-[14px]">
          {order.items.map((item) => (
            <li key={item.id}>
              {item.quantity}× {item.productName} — {formatMZN(item.totalCents)}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-2">
          {statuses
            .filter((s) => s !== order.status)
            .slice(0, 5)
            .map((s) => (
              <Button key={s} variant="secondary" size="sm" onClick={() => updateStatus(s)}>
                → {s}
              </Button>
            ))}
        </div>
      </Card>
    </div>
  );
}
