"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader, EmptyState, IndexTable, Badge as DsBadge } from "@ishopine/ui";
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
      const qs = filter !== "ALL" ? `?status=${filter}` : "";
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

  return (
    <div>
      <PageHeader
        title="Pedidos"
        description="Gerir o fluxo de pedidos da loja."
        actions={
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[200px]">
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
        }
      />

      {loading ? (
        <p className="text-[14px] text-[var(--ds-text-secondary)]">A carregar…</p>
      ) : (
        <IndexTable
          rows={orders}
          empty={
            <EmptyState
              title="Ainda sem pedidos"
              description="Quando clientes comprarem, os pedidos aparecem aqui."
            />
          }
          columns={[
            {
              key: "num",
              header: "Pedido",
              cell: (o) => (
                <Link
                  href={`/pedidos/${o.id}`}
                  className="font-medium text-[var(--ds-interactive)]"
                >
                  {o.orderNumber}
                </Link>
              ),
            },
            {
              key: "buyer",
              header: "Cliente",
              cell: (o) => o.user?.name || o.buyer?.name || "—",
            },
            {
              key: "status",
              header: "Estado",
              cell: (o) => (
                <DsBadge>{statusLabel[o.status]}</DsBadge>
              ),
            },
            {
              key: "date",
              header: "Data",
              cell: (o) => formatDateTime(o.createdAt),
            },
            {
              key: "total",
              header: "Total",
              cell: (o) => formatMZN(o.totalCents),
            },
          ]}
        />
      )}
    </div>
  );
}
