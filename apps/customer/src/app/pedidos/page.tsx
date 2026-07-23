"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, EmptyState, IndexTable } from "@ishopine/ui";
import { apiFetch } from "@/lib/api";
import { formatMZN, formatDateTime } from "@/lib/format";
import type { Order, Paginated } from "@/lib/types";

const MARKETPLACE =
  process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3000";

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Paginated<Order>>("/orders")
      .then((d) => setOrders(d.items ?? []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Pedidos" description="Histórico de compras na iShopine." />
      {loading ? (
        <p className="text-[14px] text-[var(--ds-text-secondary)]">A carregar…</p>
      ) : (
        <IndexTable
          rows={orders}
          empty={
            <EmptyState
              title="Sem pedidos ainda"
              description="Explore o marketplace e finalize a sua primeira compra."
              actionLabel="Comprar agora"
              onAction={() => {
                window.location.href = MARKETPLACE;
              }}
            />
          }
          columns={[
            {
              key: "id",
              header: "Pedido",
              cell: (o) => (
                <Link
                  href={`/pedidos/${o.id}`}
                  className="font-medium text-[var(--ds-interactive)]"
                >
                  #{o.orderNumber || o.id.slice(0, 8)}
                </Link>
              ),
            },
            {
              key: "status",
              header: "Estado",
              cell: (o) => o.status,
            },
            {
              key: "date",
              header: "Data",
              cell: (o) => formatDateTime(o.createdAt),
            },
            {
              key: "total",
              header: "Total",
              cell: (o) => formatMZN(o.totalCents ?? 0),
            },
          ]}
        />
      )}
    </div>
  );
}
