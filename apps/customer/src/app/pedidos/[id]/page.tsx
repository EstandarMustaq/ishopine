"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader, Card, Banner } from "@ishopine/ui";
import { apiFetch } from "@/lib/api";
import { formatMZN, formatDateTime } from "@/lib/format";
import type { Order } from "@/lib/types";

export default function CustomerOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    apiFetch<Order>(`/orders/${params.id}`)
      .then(setOrder)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Pedido não encontrado"),
      );
  }, [params.id]);

  if (error) {
    return (
      <Banner tone="critical" title="Erro">
        {error}. <Link href="/pedidos">Voltar</Link>
      </Banner>
    );
  }

  if (!order) {
    return <p className="text-[14px] text-[var(--ds-text-secondary)]">A carregar…</p>;
  }

  return (
    <div>
      <PageHeader
        title={`Pedido #${order.orderNumber || order.id.slice(0, 8)}`}
        description={`${order.status} · ${formatDateTime(order.createdAt)}`}
        actions={
          <Link
            href="/pedidos"
            className="text-[14px] font-medium text-[var(--ds-interactive)]"
          >
            ← Todos os pedidos
          </Link>
        }
      />
      <Card>
        <p className="text-[14px]">
          Total: <strong>{formatMZN(order.totalCents ?? 0)}</strong>
        </p>
        <ul className="mt-4 space-y-2 border-t border-[var(--ds-border-subdued)] pt-4">
          {(order.items ?? []).map((item) => (
            <li
              key={item.id}
              className="flex justify-between text-[14px]"
            >
              <span>
                {item.productName || "Item"} × {item.quantity}
              </span>
              <span>{formatMZN(item.totalCents ?? item.unitPriceCents * item.quantity)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
