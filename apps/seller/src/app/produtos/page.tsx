"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { formatMZN } from "@/lib/format";
import { useTenantStore } from "@/lib/tenant-store";
import type { Category, Paginated, Product, ProductStatus } from "@/lib/types";

export default function SellerProductsPage() {
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newStoreCat, setNewStoreCat] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    priceMzn: "",
    stock: "1",
    categoryId: "",
    status: "DRAFT" as ProductStatus,
  });

  const load = useCallback(
    async (search?: string) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ limit: "48" });
        if (search) qs.set("q", search);
        const data = await api<Paginated<Product>>(
          `/seller/products?${qs.toString()}`,
        );
        setProducts(data.items);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Erro ao carregar produtos",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const loadCategories = useCallback(async () => {
    try {
      const shopRes = await api<{ id: string }[]>("/shops/mine").catch(
        () => [] as { id: string }[],
      );
      const shopId = Array.isArray(shopRes) ? shopRes[0]?.id : undefined;
      const qs = new URLSearchParams();
      if (shopId) qs.set("shopId", shopId);
      const cats = await api<Category[]>(
        `/categories${qs.toString() ? `?${qs}` : ""}`,
      );
      setCategories(Array.isArray(cats) ? cats : []);
    } catch {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadCategories();
  }, [load, loadCategories, activeTenantId]);

  async function createStoreCategory() {
    if (!newStoreCat.trim()) return;
    try {
      await api("/seller/categories", {
        method: "POST",
        body: JSON.stringify({ name: newStoreCat.trim() }),
      });
      toast.success("Categoria da loja criada");
      setNewStoreCat("");
      await loadCategories();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao criar categoria",
      );
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const priceCents = Math.round(Number(form.priceMzn.replace(",", ".")) * 100);
    if (!form.name.trim() || !form.description.trim() || !priceCents) {
      toast.error("Preencha nome, descrição e preço");
      return;
    }
    setSaving(true);
    try {
      await api("/products", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          priceCents,
          stock: Number(form.stock) || 0,
          status: form.status,
          categoryId: form.categoryId || undefined,
        }),
      });
      toast.success("Produto criado");
      setForm({
        name: "",
        description: "",
        priceMzn: "",
        stock: "1",
        categoryId: "",
        status: "DRAFT",
      });
      setShowForm(false);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao criar produto",
      );
    } finally {
      setSaving(false);
    }
  }

  const globalCats = categories.filter((c) => !c.scope || c.scope === "GLOBAL");
  const storeCats = categories.filter((c) => c.scope === "STORE");

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Produtos</h1>
          <p className="mt-1 text-sm text-taupe">
            Catálogo do tenant activo — categorias globais + da loja.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
              className="w-48"
            />
            <Button type="submit" size="sm" variant="outline">
              Buscar
            </Button>
          </form>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Fechar" : "Novo produto"}
          </Button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={onCreate}
          className="mt-6 space-y-4 rounded-2xl border border-[var(--brand-border)] bg-white p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Nome</FieldLabel>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </Field>
            <Field>
              <FieldLabel>Preço (MZN)</FieldLabel>
              <Input
                value={form.priceMzn}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priceMzn: e.target.value }))
                }
                inputMode="decimal"
                required
              />
            </Field>
            <Field>
              <FieldLabel>Stock</FieldLabel>
              <Input
                type="number"
                min={0}
                value={form.stock}
                onChange={(e) =>
                  setForm((f) => ({ ...f, stock: e.target.value }))
                }
              />
            </Field>
            <Field>
              <FieldLabel>Estado</FieldLabel>
              <select
                className="flex h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as ProductStatus,
                  }))
                }
              >
                <option value="DRAFT">Rascunho</option>
                <option value="ACTIVE">Activo</option>
                <option value="ARCHIVED">Arquivado</option>
              </select>
            </Field>
          </div>
          <Field>
            <FieldLabel>Descrição</FieldLabel>
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={3}
              required
            />
          </Field>
          <Field>
            <FieldLabel>Categoria (global ou loja)</FieldLabel>
            <select
              className="flex h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
              value={form.categoryId}
              onChange={(e) =>
                setForm((f) => ({ ...f, categoryId: e.target.value }))
              }
            >
              <option value="">Sem categoria</option>
              {globalCats.length > 0 && (
                <optgroup label="Global">
                  {globalCats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {storeCats.length > 0 && (
                <optgroup label="Da loja">
                  {storeCats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </Field>
          <div className="flex flex-wrap items-end gap-2 rounded-xl bg-[var(--brand-surface)] p-3">
            <Field className="min-w-[12rem] flex-1">
              <FieldLabel>Nova categoria da loja</FieldLabel>
              <Input
                value={newStoreCat}
                onChange={(e) => setNewStoreCat(e.target.value)}
                placeholder="Ex.: Sofás usados"
              />
            </Field>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void createStoreCategory()}
            >
              Criar categoria
            </Button>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "A guardar…" : "Publicar produto"}
          </Button>
        </form>
      )}

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
                            {product.category?.scope === "STORE"
                              ? " · loja"
                              : product.category
                                ? " · global"
                                : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-taupe">{product.sku}</td>
                    <td className="px-4 py-3 font-medium">
                      {formatMZN(product.priceCents)}
                    </td>
                    <td className="px-4 py-3">{product.stock}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{product.status}</Badge>
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-taupe"
                  >
                    Nenhum produto neste tenant. Crie o primeiro.
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
