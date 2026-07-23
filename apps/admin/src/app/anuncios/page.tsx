"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, LoadingState } from "@ishopine/ui";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import type { Ad, AdSlot, AdStatus } from "@/lib/types";

const SLOTS: { value: AdSlot; label: string }[] = [
  { value: "HOME_HERO", label: "Home hero" },
  { value: "HOME_STRIP", label: "Home faixa" },
  { value: "MERCADO_TOP", label: "Mercado topo" },
  { value: "LOJAS_TOP", label: "Lojas topo" },
];

const STATUSES: { value: AdStatus; label: string }[] = [
  { value: "DRAFT", label: "Rascunho" },
  { value: "ACTIVE", label: "Activo" },
  { value: "PAUSED", label: "Pausado" },
  { value: "EXPIRED", label: "Expirado" },
];

const emptyForm = {
  title: "",
  subtitle: "",
  imageUrl: "",
  linkUrl: "",
  slot: "HOME_STRIP" as AdSlot,
  status: "DRAFT" as AdStatus,
  priority: "0",
};

export default function PainelAnunciosPage() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    try {
      const data = await api<Ad[]>("/ads/admin");
      setAds(data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar anúncios",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createAd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/ads", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          subtitle: form.subtitle || undefined,
          imageUrl: form.imageUrl,
          linkUrl: form.linkUrl,
          slot: form.slot,
          status: form.status,
          priority: Number(form.priority) || 0,
        }),
      });
      setForm(emptyForm);
      toast.success("Anúncio criado");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao criar anúncio",
      );
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: AdStatus) {
    try {
      await api(`/ads/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao actualizar",
      );
    }
  }

  async function removeAd(id: string) {
    try {
      await api(`/ads/${id}`, { method: "DELETE" });
      toast.success("Anúncio removido");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao remover",
      );
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal">Anúncios</h1>
      <p className="mt-1 text-sm text-taupe">
        Faixas promocionais no mercado, lojas e página inicial.
      </p>

      <form
        onSubmit={createAd}
        className="mt-8 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-soft sm:grid-cols-2"
      >
        <Field className="sm:col-span-2">
          <FieldLabel>Título</FieldLabel>
          <Input
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel>Subtítulo</FieldLabel>
          <Input
            value={form.subtitle}
            onChange={(e) =>
              setForm((f) => ({ ...f, subtitle: e.target.value }))
            }
          />
        </Field>
        <Field>
          <FieldLabel>URL da imagem</FieldLabel>
          <Input
            required
            value={form.imageUrl}
            onChange={(e) =>
              setForm((f) => ({ ...f, imageUrl: e.target.value }))
            }
            placeholder="https://…"
          />
        </Field>
        <Field>
          <FieldLabel>Link de destino</FieldLabel>
          <Input
            required
            value={form.linkUrl}
            onChange={(e) =>
              setForm((f) => ({ ...f, linkUrl: e.target.value }))
            }
            placeholder="/produtos ou https://…"
          />
        </Field>
        <Field>
          <FieldLabel>Slot</FieldLabel>
          <Select
            value={form.slot}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, slot: v as AdSlot }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SLOTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Estado</FieldLabel>
          <Select
            value={form.status}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, status: v as AdStatus }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Prioridade</FieldLabel>
          <Input
            type="number"
            value={form.priority}
            onChange={(e) =>
              setForm((f) => ({ ...f, priority: e.target.value }))
            }
          />
        </Field>
        <div className="flex items-end sm:col-span-2">
          <Button type="submit" disabled={saving} className="rounded-full">
            {saving ? "A guardar…" : "Criar anúncio"}
          </Button>
        </div>
      </form>

      <div className="mt-8 space-y-3">
        {loading && <LoadingState label="A carregar anúncios" variant="skeleton" />}
        {!loading && ads.length === 0 && (
          <EmptyState
            title="Sem anúncios"
            description="Crie uma faixa para publicar nos espaços comerciais do marketplace."
          />
        )}
        {ads.map((ad) => (
          <div
            key={ad.id}
            className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-soft sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-zinc-900">{ad.title}</p>
              <p className="mt-0.5 text-[12px] text-zinc-500">
                {ad.slot} · {ad.status} · prioridade {ad.priority}
              </p>
              <p className="mt-1 truncate text-[12px] text-zinc-400">
                {ad.linkUrl}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ad.status !== "ACTIVE" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => void setStatus(ad.id, "ACTIVE")}
                >
                  Activar
                </Button>
              )}
              {ad.status === "ACTIVE" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => void setStatus(ad.id, "PAUSED")}
                >
                  Pausar
                </Button>
              )}
              <Button
                size="sm"
                variant="destructive"
                className="rounded-full"
                onClick={() => void removeAd(ad.id)}
              >
                Remover
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
