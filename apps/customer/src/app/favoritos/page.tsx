"use client";

import { useEffect, useState } from "react";
import { PageHeader, EmptyState, Card, LoadingState } from "@ishopine/ui";
import { apiFetch } from "@/lib/api";
import { formatMZN } from "@/lib/format";

type WishlistItem = {
  id: string;
  productId: string;
  product?: {
    id: string;
    name: string;
    slug?: string;
    priceCents?: number;
  };
};

const MARKETPLACE =
  process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3000";

export default function CustomerWishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<WishlistItem[] | { items: WishlistItem[] }>("/wishlist")
      .then((d) => setItems(Array.isArray(d) ? d : d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Favoritos" description="Produtos que guardou." />
      {loading ? (
        <LoadingState label="A carregar favoritos" variant="skeleton" />
      ) : items.length === 0 ? (
        <EmptyState
          title="Sem favoritos"
          description="Guarde produtos no marketplace para os encontrar aqui."
          actionLabel="Explorar produtos"
          onAction={() => {
            window.location.href = `${MARKETPLACE}/produtos`;
          }}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id}>
              <Card>
                <a
                  href={`${MARKETPLACE}/produtos/${item.product?.slug || item.productId}`}
                  className="block"
                >
                  <p className="text-[14px] font-semibold">
                    {item.product?.name || "Produto"}
                  </p>
                  <p className="mt-1 text-[14px] text-[var(--ds-text-secondary)]">
                    {formatMZN(item.product?.priceCents ?? 0)}
                  </p>
                </a>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
