"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ProductCard } from "@/components/products/product-card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { WishlistItem } from "@/lib/types";

export default function FavoritosPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    try {
      const data = await api<WishlistItem[] | { items: WishlistItem[] }>(
        "/wishlist",
      );
      setItems(Array.isArray(data) ? data : (data.items ?? []));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!accessToken) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Favoritos</h1>
        <p className="mt-3 text-sm text-taupe">
          Entre para ver os produtos que você salvou.
        </p>
        <Button asChild className="mt-6">
          <Link href="/entrar">Entrar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-charcoal">Favoritos</h1>
      <p className="mt-2 text-sm text-taupe">
        Produtos que você marcou no iShoppine.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-taupe">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-[12px] bg-beige px-6 py-12 text-center">
          <p className="text-sm text-taupe">
            Sua lista de favoritos está vazia.
          </p>
          <Button asChild className="mt-4">
            <Link href="/produtos">Explorar mercado</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {items.map((item) =>
            item.product ? (
              <ProductCard key={item.id || item.productId} product={item.product} />
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
