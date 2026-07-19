"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatBRL } from "@/lib/format";
import type { Cart } from "@/lib/types";

export default function CartPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCart = useCallback(async () => {
    if (!accessToken) {
      setCart(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api<Cart>("/cart");
      setCart(data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar carrinho",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  async function updateQty(productId: string, quantity: number) {
    try {
      if (quantity < 1) {
        await api(`/cart/items/${productId}`, { method: "DELETE" });
      } else {
        await api(`/cart/items/${productId}`, {
          method: "PATCH",
          body: JSON.stringify({ quantity }),
        });
      }
      await loadCart();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível atualizar",
      );
    }
  }

  if (!accessToken) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-charcoal">Carrinho</h1>
        <p className="mt-3 text-sm text-taupe">
          Faça login para ver os itens do seu carrinho.
        </p>
        <Button asChild className="mt-6">
          <Link href="/entrar">Entrar</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-taupe">Carregando...</div>
    );
  }

  const items = cart?.items ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-charcoal">Carrinho</h1>

      {items.length === 0 ? (
        <div className="mt-10 rounded-[12px] bg-beige px-6 py-12 text-center">
          <p className="text-sm text-taupe">Seu carrinho está vazio.</p>
          <Button asChild className="mt-6">
            <Link href="/produtos">Continuar comprando</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px]">
          <ul className="divide-y divide-[var(--mavula-nav-divider)]">
            {items.map((item) => {
              const image =
                item.product.images?.[0]?.url ??
                "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=400&q=80";
              return (
                <li key={item.id} className="flex gap-4 py-5">
                  <div className="relative size-24 shrink-0 overflow-hidden rounded-[12px] bg-beige">
                    <Image
                      src={image}
                      alt={item.product.name}
                      fill
                      className="object-cover"
                      sizes="96px"
                    />
                  </div>
                  <div className="flex flex-1 flex-col">
                    <Link
                      href={`/produtos/${item.product.slug}`}
                      className="font-semibold text-charcoal hover:text-[#61005D]"
                    >
                      {item.product.name}
                    </Link>
                    <p className="mt-1 text-sm font-bold text-[#61005D]">
                      {formatBRL(item.product.priceCents)}
                    </p>
                    <div className="mt-auto flex items-center gap-2 pt-3">
                      <Button
                        variant="outline"
                        size="icon-xs"
                        onClick={() =>
                          updateQty(item.productId, item.quantity - 1)
                        }
                      >
                        <Minus />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon-xs"
                        onClick={() =>
                          updateQty(item.productId, item.quantity + 1)
                        }
                      >
                        <Plus />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="ml-auto text-taupe"
                        onClick={() => updateQty(item.productId, 0)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <aside className="h-fit rounded-[12px] bg-beige p-5">
            <h2 className="font-semibold text-charcoal">Resumo</h2>
            <div className="mt-4 flex justify-between text-sm">
              <span className="text-taupe">Subtotal</span>
              <span className="font-bold text-charcoal">
                {formatBRL(cart?.subtotalCents ?? 0)}
              </span>
            </div>
            <p className="mt-2 text-xs text-taupe">
              Frete calculado no checkout.
            </p>
            <Button asChild className="mt-6 w-full">
              <Link href="/checkout">Finalizar compra</Link>
            </Button>
          </aside>
        </div>
      )}
    </div>
  );
}
