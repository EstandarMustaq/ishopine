"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Card, CardTitle, CardDescription, EmptyState, Banner } from "@ishopine/ui";
import { apiFetch } from "@/lib/api";
import { formatMZN, formatDateTime } from "@/lib/format";
import { useAuthStore } from "@/lib/auth-store";
import type { Order, Paginated } from "@/lib/types";

const MARKETPLACE =
  process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3000";

export default function CustomerHomePage() {
  const user = useAuthStore((s) => s.user);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Paginated<Order>>("/orders?limit=5")
      .then((d) => setOrders(d.items ?? []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title={`Olá, ${user?.name?.split(" ")[0] || "cliente"}`}
        description="Gerir pedidos, endereços e favoritos na sua conta iShopine."
      />

      <Banner tone="info" title="Bem-vindo à conta do cliente" className="mb-6">
        Compre no marketplace e acompanhe tudo aqui.{" "}
        <a href={MARKETPLACE} className="font-medium text-[var(--ds-interactive)] underline">
          Ir ao mercado
        </a>
      </Banner>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardTitle>Pedidos recentes</CardTitle>
          <CardDescription className="mt-1">
            {loading ? "…" : `${orders.length} nos últimos resultados`}
          </CardDescription>
          <Link
            href="/pedidos"
            className="mt-4 inline-block text-[14px] font-medium text-[var(--ds-brand)]"
          >
            Ver todos →
          </Link>
        </Card>
        <Card>
          <CardTitle>Endereços</CardTitle>
          <CardDescription className="mt-1">
            Entregas em Moçambique (MZN)
          </CardDescription>
          <Link
            href="/enderecos"
            className="mt-4 inline-block text-[14px] font-medium text-[var(--ds-brand)]"
          >
            Gerir →
          </Link>
        </Card>
        <Card>
          <CardTitle>Favoritos</CardTitle>
          <CardDescription className="mt-1">Produtos guardados</CardDescription>
          <Link
            href="/favoritos"
            className="mt-4 inline-block text-[14px] font-medium text-[var(--ds-brand)]"
          >
            Ver lista →
          </Link>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-[16px] font-semibold">Últimos pedidos</h2>
        {!loading && orders.length === 0 ? (
          <EmptyState
            title="Ainda sem pedidos"
            description="Quando comprar no marketplace, os pedidos aparecem aqui."
            actionLabel="Ir ao marketplace"
            onAction={() => {
              window.location.href = MARKETPLACE;
            }}
          />
        ) : (
          <ul className="space-y-2">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/pedidos/${o.id}`}
                  className="flex items-center justify-between rounded-[var(--ds-radius-md)] border border-[var(--ds-border-subdued)] bg-white px-4 py-3 shadow-[var(--ds-shadow-raised)] hover:bg-[var(--ds-bg)]"
                >
                  <div>
                    <p className="text-[14px] font-medium">#{o.orderNumber || o.id.slice(0, 8)}</p>
                    <p className="text-[12px] text-[var(--ds-text-secondary)]">
                      {formatDateTime(o.createdAt)} · {o.status}
                    </p>
                  </div>
                  <p className="text-[14px] font-semibold">
                    {formatMZN(o.totalCents ?? 0)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
