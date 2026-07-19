"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { InventoryMovement, Product } from "@/lib/types";

export default function PainelEstoquePage() {
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<Product[]>("/inventory/low-stock"),
      api<InventoryMovement[]>("/inventory/movements"),
    ])
      .then(([low, moves]) => {
        setLowStock(low);
        setMovements(moves);
      })
      .catch((error) =>
        toast.error(
          error instanceof Error ? error.message : "Erro ao carregar estoque",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-taupe">Carregando estoque...</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal">Estoque</h1>
      <p className="mt-1 text-sm text-taupe">
        Produtos com estoque baixo e movimentações recentes.
      </p>

      <Tabs defaultValue="low" className="mt-8">
        <TabsList>
          <TabsTrigger value="low">Estoque baixo</TabsTrigger>
          <TabsTrigger value="moves">Movimentações</TabsTrigger>
        </TabsList>

        <TabsContent value="low" className="mt-4">
          <div className="overflow-x-auto rounded-[12px] border border-border">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-beige text-taupe">
                <tr>
                  <th className="px-4 py-3 font-medium">Produto</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Estoque</th>
                  <th className="px-4 py-3 font-medium">Reservado</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-taupe">{p.sku}</td>
                    <td className="px-4 py-3 font-bold text-[#61005D]">
                      {p.stock}
                    </td>
                    <td className="px-4 py-3">{p.reservedStock}</td>
                  </tr>
                ))}
                {lowStock.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-taupe"
                    >
                      Nenhum produto com estoque baixo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="moves" className="mt-4">
          <div className="overflow-x-auto rounded-[12px] border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-beige text-taupe">
                <tr>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Produto</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Qtd</th>
                  <th className="px-4 py-3 font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-4 py-3 text-taupe">
                      {formatDateTime(m.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {m.product?.name ?? m.productId}
                    </td>
                    <td className="px-4 py-3">{m.type}</td>
                    <td className="px-4 py-3">{m.quantity}</td>
                    <td className="px-4 py-3 text-taupe">{m.reason}</td>
                  </tr>
                ))}
                {movements.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-taupe"
                    >
                      Nenhuma movimentação registrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
