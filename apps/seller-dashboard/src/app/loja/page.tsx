"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ReputationBadge } from "@/components/shops/reputation-badge";
import { api, getApiBase } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import {
  districtsForProvince,
  MZ_PROVINCES,
  SHOP_TYPES,
  shopTypeLabel,
  type ShopTypeValue,
} from "@/lib/mozambique";
import type { Shop, User } from "@/lib/types";

type EditForm = {
  name: string;
  description: string;
  policiesText: string;
  hoursText: string;
  logoUrl: string;
  bannerUrl: string;
};

export default function PainelLojaPage() {
  const setUser = useAuthStore((s) => s.setUser);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    description: "",
    policiesText: "",
    hoursText: "",
    logoUrl: "",
    bannerUrl: "",
  });
  const [uploading, setUploading] = useState<"logo" | "banner" | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    shopType: "OTHER" as ShopTypeValue,
    province: "",
    district: "",
    latitude: "",
    longitude: "",
  });

  const districts = useMemo(
    () => districtsForProvince(form.province),
    [form.province],
  );

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

  function startEdit(shop: Shop) {
    setEditingId(shop.id);
    setEditForm({
      name: shop.name,
      description: shop.description || "",
      policiesText: shop.policiesText || "",
      hoursText: shop.hoursJson
        ? Object.entries(shop.hoursJson)
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n")
        : "",
      logoUrl: shop.logoUrl || "",
      bannerUrl: shop.bannerUrl || "",
    });
  }

  function parseHours(text: string): Record<string, string> | undefined {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return undefined;
    const out: Record<string, string> = {};
    for (const line of lines) {
      const [k, ...rest] = line.split(":");
      if (!k || rest.length === 0) continue;
      out[k.trim().toLowerCase()] = rest.join(":").trim();
    }
    return Object.keys(out).length ? out : undefined;
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    try {
      await api(`/shops/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description || undefined,
          policiesText: editForm.policiesText || undefined,
          hoursJson: parseHours(editForm.hoursText),
          logoUrl: editForm.logoUrl || undefined,
          bannerUrl: editForm.bannerUrl || undefined,
        }),
      });
      toast.success("Loja actualizada");
      setEditingId(null);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao guardar loja",
      );
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(kind: "logo" | "banner", file: File) {
    if (!editingId) return;
    setUploading(kind);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const asset = await api<{ url: string }>(
        `/uploads?folder=shops&shopId=${editingId}`,
        { method: "POST", body: fd },
      );
      const absolute = asset.url.startsWith("http")
        ? asset.url
        : `${getApiBase()}${asset.url}`;
      setEditForm((s) =>
        kind === "logo"
          ? { ...s, logoUrl: absolute }
          : { ...s, bannerUrl: absolute },
      );
      toast.success(kind === "logo" ? "Logo enviado" : "Banner enviado");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro no upload",
      );
    } finally {
      setUploading(null);
    }
  }

  function useGeolocation() {
    if (!navigator.geolocation) {
      toast.error("Geolocalização não suportada neste dispositivo");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((s) => ({
          ...s,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setLocating(false);
        toast.success("Localização capturada");
      },
      () => {
        setLocating(false);
        toast.error("Não foi possível obter a localização");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Nome da loja é obrigatório");
      return;
    }
    if (!form.province || !form.district) {
      toast.error("Selecione província e distrito");
      return;
    }
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      toast.error("Informe coordenadas válidas ou use GPS");
      return;
    }
    setSaving(true);
    try {
      const shop = await api<Shop>("/shops", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description || undefined,
          shopType: form.shopType,
          province: form.province,
          district: form.district,
          latitude,
          longitude,
        }),
      });
      toast.success(`Loja "${shop.name}" criada!`);
      setForm({
        name: "",
        description: "",
        shopType: "OTHER",
        province: "",
        district: "",
        latitude: "",
        longitude: "",
      });
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
        Perfil, políticas, horários e media da vitrine.
      </p>

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-taupe">
          <Spinner className="size-4" /> Carregando...
        </div>
      ) : shops.length > 0 ? (
        <ul className="mt-8 space-y-4">
          {shops.map((shop) => (
            <li
              key={shop.id}
              className="rounded-[12px] border border-border p-5"
            >
              {editingId === shop.id ? (
                <form onSubmit={saveEdit} className="space-y-4">
                  <Field>
                    <FieldLabel>Nome</FieldLabel>
                    <Input
                      required
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm((s) => ({ ...s, name: e.target.value }))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Descrição</FieldLabel>
                    <Textarea
                      rows={3}
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm((s) => ({
                          ...s,
                          description: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Políticas (devoluções / envio)</FieldLabel>
                    <Textarea
                      rows={3}
                      value={editForm.policiesText}
                      onChange={(e) =>
                        setEditForm((s) => ({
                          ...s,
                          policiesText: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Horários (uma linha por dia: mon: 09-18)</FieldLabel>
                    <Textarea
                      rows={4}
                      value={editForm.hoursText}
                      onChange={(e) =>
                        setEditForm((s) => ({
                          ...s,
                          hoursText: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>Logo</FieldLabel>
                      <Input
                        type="file"
                        accept="image/*"
                        disabled={uploading === "logo"}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadImage("logo", f);
                        }}
                      />
                      {editForm.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={editForm.logoUrl}
                          alt=""
                          className="mt-2 size-16 rounded-lg object-cover"
                        />
                      ) : null}
                    </Field>
                    <Field>
                      <FieldLabel>Banner</FieldLabel>
                      <Input
                        type="file"
                        accept="image/*"
                        disabled={uploading === "banner"}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadImage("banner", f);
                        }}
                      />
                      {editForm.bannerUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={editForm.bannerUrl}
                          alt=""
                          className="mt-2 h-16 w-full rounded-lg object-cover"
                        />
                      ) : null}
                    </Field>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving}>
                      {saving ? <Spinner className="size-4" /> : null}
                      Guardar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingId(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-charcoal">
                      {shop.name}
                    </p>
                    <p className="mt-1 text-xs text-taupe">/{shop.slug}</p>
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                      {shopTypeLabel(shop.shopType)}
                    </p>
                    {shop.description && (
                      <p className="mt-2 text-sm text-taupe">
                        {shop.description}
                      </p>
                    )}
                    <ReputationBadge
                      className="mt-3"
                      ratingAvg={shop.ratingAvg}
                      ratingCount={shop.ratingCount}
                      reputationScore={shop.reputationScore}
                    />
                    <p className="mt-2 text-xs text-taupe">
                      {[shop.district, shop.province]
                        .filter(Boolean)
                        .join(" · ")}
                      {shop._count?.products != null
                        ? ` · ${shop._count.products} produtos`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(shop)}
                    >
                      Editar
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        href={`${process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3000"}/lojas/${shop.slug}`}
                      >
                        Ver vitrine
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <form
          onSubmit={onCreate}
          className="mt-8 space-y-5 rounded-[12px] border border-border bg-beige p-5"
        >
          <p className="text-sm font-semibold text-charcoal">Abrir loja</p>
          <Field>
            <FieldLabel htmlFor="name">Nome da loja</FieldLabel>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="description">Descrição</FieldLabel>
            <Textarea
              id="description"
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm((s) => ({ ...s, description: e.target.value }))
              }
            />
          </Field>
          <Field>
            <FieldLabel>Tipo de loja</FieldLabel>
            <Select
              value={form.shopType}
              onValueChange={(value) =>
                setForm((s) => ({ ...s, shopType: value as ShopTypeValue }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {SHOP_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Província</FieldLabel>
              <Select
                value={form.province || undefined}
                onValueChange={(value) =>
                  setForm((s) => ({ ...s, province: value, district: "" }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Província" />
                </SelectTrigger>
                <SelectContent>
                  {MZ_PROVINCES.map((province) => (
                    <SelectItem key={province.name} value={province.name}>
                      {province.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Distrito</FieldLabel>
              <Select
                value={form.district || undefined}
                onValueChange={(value) =>
                  setForm((s) => ({ ...s, district: value }))
                }
                disabled={!form.province}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Distrito" />
                </SelectTrigger>
                <SelectContent>
                  {districts.map((district) => (
                    <SelectItem key={district} value={district}>
                      {district}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <Field>
              <FieldLabel htmlFor="latitude">Latitude</FieldLabel>
              <Input
                id="latitude"
                required
                inputMode="decimal"
                value={form.latitude}
                onChange={(e) =>
                  setForm((s) => ({ ...s, latitude: e.target.value }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="longitude">Longitude</FieldLabel>
              <Input
                id="longitude"
                required
                inputMode="decimal"
                value={form.longitude}
                onChange={(e) =>
                  setForm((s) => ({ ...s, longitude: e.target.value }))
                }
              />
            </Field>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={useGeolocation}
                disabled={locating}
                className="w-full gap-1.5"
              >
                {locating ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <MapPin className="size-3.5" />
                )}
                GPS
              </Button>
            </div>
          </div>
          <FieldDescription>
            Use GPS ou informe coordenadas em Moçambique. Texto livre de
            localização não é aceite.
          </FieldDescription>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? <Spinner className="size-4" /> : null}
            {saving ? "A criar…" : "Criar loja"}
          </Button>
        </form>
      )}
    </div>
  );
}
