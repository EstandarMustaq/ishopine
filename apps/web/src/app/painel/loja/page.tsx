"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { Shop, User } from "@/lib/types";

export default function PainelLojaPage() {
  const setUser = useAuthStore((s) => s.setUser);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    city: "",
    state: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<Shop[]>("/shops/mine");
      setShops(data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar lojas",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const shop = await api<Shop>("/shops", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
        }),
      });
      toast.success(`Loja "${shop.name}" criada!`);
      setForm({ name: "", description: "", city: "", state: "" });
      const me = await api<User>("/auth/me");
      setUser(me);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao criar loja",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-charcoal">Minha loja</h1>
      <p className="mt-1 text-sm text-taupe">
        Abra ou gerencie sua vitrine no mercado iShopine.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-taupe">Carregando...</p>
      ) : shops.length > 0 ? (
        <ul className="mt-8 space-y-4">
          {shops.map((shop) => (
            <li
              key={shop.id}
              className="rounded-[12px] border border-border p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-charcoal">
                    {shop.name}
                  </p>
                  <p className="mt-1 text-xs text-taupe">/{shop.slug}</p>
                  {shop.description && (
                    <p className="mt-2 text-sm text-taupe">{shop.description}</p>
                  )}
                  <p className="mt-2 text-xs text-taupe">
                    {[shop.city, shop.state].filter(Boolean).join(" · ") ||
                      "Local não informado"}
                    {shop._count?.products != null
                      ? ` · ${shop._count.products} produtos`
                      : ""}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/lojas/${shop.slug}`}>Ver vitrine</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <form
          onSubmit={onCreate}
          className="mt-8 space-y-4 rounded-[12px] border border-border bg-beige p-5"
        >
          <p className="text-sm font-semibold text-charcoal">Abrir loja</p>
          <div>
            <Label htmlFor="name">Nome da loja</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm((s) => ({ ...s, description: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) =>
                  setForm((s) => ({ ...s, city: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="state">Estado</Label>
              <Input
                id="state"
                value={form.state}
                onChange={(e) =>
                  setForm((s) => ({ ...s, state: e.target.value }))
                }
              />
            </div>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Criando..." : "Abrir loja"}
          </Button>
        </form>
      )}

      {shops.length > 0 && (
        <p className="mt-6 text-sm text-taupe">
          Cadastre produtos em{" "}
          <Link href="/painel/produtos" className="font-medium text-[#111111]">
            Produtos
          </Link>
          .
        </p>
      )}
    </div>
  );
}
