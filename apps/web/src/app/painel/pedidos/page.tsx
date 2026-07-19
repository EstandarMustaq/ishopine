"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatMZN, formatDateTime } from "@/lib/format";
import type { Order, OrderStatus, Paginated } from "@/lib/types";

const statuses: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

const statusLabel: Record<OrderStatus, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  PROCESSING: "Em preparo",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
};

export default function PainelPedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs =
        filter !== "ALL" ? `?status=${filter}` : "";
      const data = await api<Paginated<Order>>(`/orders${qs}`);
      setOrders(data.items);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar pedidos",
      );
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(id: string, status: OrderStatus) {
    try {
      await api(`/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      toast.success("Status atualizado");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao atualizar status",
      );
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Pedidos</h1>
          <p className="mt-1 text-sm text-taupe">
            Gerencie o fluxo de pedidos da loja.
          </p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px] rounded-[16px]">
            <SelectValue placeholder="Filtrar status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-taupe">Carregando...</p>
      ) : (
        <div className="mt-8 space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-[12px] border border-border p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{order.orderNumber}</p>
                  <p className="text-sm text-taupe">
                    {order.user?.name} · {order.user?.email}
                    {order.sellerShop?.name
                      ? ` · Loja: ${order.sellerShop.name}`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-taupe">
                    {formatDateTime(order.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant="secondary">
                    {statusLabel[order.status]}
                  </Badge>
                  <p className="mt-2 font-bold text-[#111111]">
                    {formatMZN(order.totalCents)}
                  </p>
                </div>
              </div>
              <ul className="mt-3 text-sm text-taupe">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.quantity}× {item.productName}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                {statuses
                  .filter((s) => s !== order.status)
                  .slice(0, 4)
                  .map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(order.id, s)}
                    >
                      {statusLabel[s]}
                    </Button>
                  ))}
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <p className="text-sm text-taupe">Nenhum pedido encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
}
