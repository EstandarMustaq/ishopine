"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { formatBRL } from "@/lib/format";
import type { Paginated, Product } from "@/lib/types";

export default function PainelProdutosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(search?: string) {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "48" });
      if (search) qs.set("q", search);
      const data = await api<Paginated<Product>>(
        `/admin/products?${qs.toString()}`,
      );
      setProducts(data.items);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar produtos",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Produtos</h1>
          <p className="mt-1 text-sm text-taupe">
            Catálogo completo (admin/operador).
          </p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void load(q);
          }}
        >
          <Input
            placeholder="Buscar produto..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-56"
          />
          <Button type="submit" size="sm">
            Buscar
          </Button>
        </form>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-taupe">Carregando...</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-[12px] border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-beige text-taupe">
              <tr>
                <th className="px-4 py-3 font-medium">Produto</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Preço</th>
                <th className="px-4 py-3 font-medium">Estoque</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const image = product.images?.[0]?.url;
                return (
                  <tr key={product.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative size-12 overflow-hidden rounded-[8px] bg-beige">
                          {image && (
                            <Image
                              src={image}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-taupe">
                            {product.category?.name ?? "Sem categoria"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-taupe">{product.sku}</td>
                    <td className="px-4 py-3 font-medium">
                      {formatBRL(product.priceCents)}
                    </td>
                    <td className="px-4 py-3">{product.stock}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{product.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/produtos/${product.slug}`}>Ver</Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-taupe"
                  >
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
