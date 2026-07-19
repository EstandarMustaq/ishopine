"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatBRL, formatDateTime } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";

const statusLabel: Record<OrderStatus, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  PROCESSING: "Em preparo",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
};

export default function AccountPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    try {
      const data = await api<Order[]>("/orders/mine");
      setOrders(data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar pedidos",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!accessToken || !user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Minha conta</h1>
        <p className="mt-3 text-sm text-taupe">
          Entre para ver seus pedidos.
        </p>
        <Button asChild className="mt-6">
          <Link href="/entrar">Entrar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-charcoal">Olá, {user.name}</h1>
      <p className="mt-2 text-sm text-taupe">{user.email}</p>

      {(user.canSell ||
        user.platformRole === "SELLER" ||
        user.platformRole === "PLATFORM_ADMIN" ||
        user.platformRole === "PLATFORM_OPERATOR" ||
        user.role === "SELLER" ||
        user.role === "PLATFORM_ADMIN" ||
        user.role === "PLATFORM_OPERATOR") && (
        <Button asChild variant="outline" className="mt-4" size="sm">
          <Link href="/painel">Ir para o painel</Link>
        </Button>
      )}

      <h2 className="mt-10 text-xl font-semibold">Pedidos de compra</h2>

      {loading ? (
        <p className="mt-6 text-sm text-taupe">Carregando...</p>
      ) : orders.length === 0 ? (
        <div className="mt-6 rounded-[12px] bg-beige px-6 py-10 text-center">
          <p className="text-sm text-taupe">Você ainda não fez pedidos.</p>
          <Button asChild className="mt-4">
            <Link href="/produtos">Começar a comprar</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {orders.map((order) => (
            <li
              key={order.id}
              className="rounded-[12px] border border-border p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-charcoal">
                    Pedido {order.orderNumber}
                  </p>
                  <p className="mt-1 text-xs text-taupe">
                    {formatDateTime(order.createdAt)}
                    {order.sellerShop?.name
                      ? ` · ${order.sellerShop.name}`
                      : ""}
                  </p>
                </div>
                <Badge variant="secondary">
                  {statusLabel[order.status]}
                </Badge>
              </div>
              <ul className="mt-4 space-y-1 text-sm text-taupe">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.quantity}× {item.productName}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm font-bold text-[#61005D]">
                Total {formatBRL(order.totalCents)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
