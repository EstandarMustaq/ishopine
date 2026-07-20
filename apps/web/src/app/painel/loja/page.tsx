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
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import {
  districtsForProvince,
  MZ_PROVINCES,
  SHOP_TYPES,
  shopTypeLabel,
  type ShopTypeValue,
} from "@/lib/mozambique";
import type { Shop, User } from "@/lib/types";

export default function PainelLojaPage() {
  const setUser = useAuthStore((s) => s.setUser);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
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
    setSaving(true);
    try {
      const shop = await api<Shop>("/shops", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          shopType: form.shopType,
          province: form.province,
          district: form.district,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
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
        Abra ou gerencie sua vitrine. Geolocalização por província e distrito é
        obrigatória.
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
                    <p className="mt-2 text-sm text-taupe">{shop.description}</p>
                  )}
                  <ReputationBadge
                    className="mt-3"
                    ratingAvg={shop.ratingAvg}
                    ratingCount={shop.ratingCount}
                    reputationScore={shop.reputationScore}
                  />
                  <p className="mt-2 text-xs text-taupe">
                    {[shop.district, shop.province].filter(Boolean).join(" · ")}
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
                {locating ? <Spinner className="size-3.5" /> : <MapPin className="size-3.5" />}
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
