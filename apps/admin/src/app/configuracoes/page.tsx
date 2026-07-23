"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthGate } from "@/components/dashboard/auth-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { StoreSettings } from "@/lib/types";

export default function PainelConfiguracoesPage() {
  return (
    <AuthGate adminOnly>
      <SettingsContent />
    </AuthGate>
  );
}

function SettingsContent() {
  const [form, setForm] = useState({
    storeName: "",
    tagline: "",
    supportEmail: "",
    supportPhone: "",
    shippingFlatCents: "",
    freeShippingCents: "",
    logoUrl: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<StoreSettings>("/store/settings", { token: null })
      .then((settings) => {
        setForm({
          storeName: settings.storeName,
          tagline: settings.tagline,
          supportEmail: settings.supportEmail,
          supportPhone: settings.supportPhone ?? "",
          shippingFlatCents: String(settings.shippingFlatCents / 100),
          freeShippingCents: String(settings.freeShippingCents / 100),
          logoUrl: settings.logoUrl ?? "",
        });
      })
      .catch((error) =>
        toast.error(
          error instanceof Error
            ? error.message
            : "Erro ao carregar configurações",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api<StoreSettings>("/store/settings", {
        method: "PATCH",
        body: JSON.stringify({
          storeName: form.storeName,
          tagline: form.tagline,
          supportEmail: form.supportEmail,
          supportPhone: form.supportPhone || undefined,
          shippingFlatCents: Math.round(
            Number(form.shippingFlatCents.replace(",", ".")) * 100,
          ),
          freeShippingCents: Math.round(
            Number(form.freeShippingCents.replace(",", ".")) * 100,
          ),
          logoUrl: form.logoUrl || undefined,
        }),
      });
      toast.success("Configurações salvas");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao salvar",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-taupe">Carregando...</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal">Configurações</h1>
      <p className="mt-1 text-sm text-taupe">
        Configurações da plataforma iShopine (somente admin).
      </p>

      <form
        onSubmit={onSave}
        className="mt-8 max-w-xl space-y-4 rounded-[12px] border border-border p-5"
      >
        <div>
          <Label htmlFor="storeName">Nome da loja</Label>
          <Input
            id="storeName"
            value={form.storeName}
            onChange={(e) =>
              setForm((s) => ({ ...s, storeName: e.target.value }))
            }
          />
        </div>
        <div>
          <Label htmlFor="tagline">Slogan</Label>
          <Input
            id="tagline"
            value={form.tagline}
            onChange={(e) =>
              setForm((s) => ({ ...s, tagline: e.target.value }))
            }
          />
        </div>
        <div>
          <Label htmlFor="supportEmail">E-mail de suporte</Label>
          <Input
            id="supportEmail"
            type="email"
            value={form.supportEmail}
            onChange={(e) =>
              setForm((s) => ({ ...s, supportEmail: e.target.value }))
            }
          />
        </div>
        <div>
          <Label htmlFor="supportPhone">Telefone</Label>
          <Input
            id="supportPhone"
            value={form.supportPhone}
            onChange={(e) =>
              setForm((s) => ({ ...s, supportPhone: e.target.value }))
            }
          />
        </div>
        <div>
          <Label htmlFor="shipping">Frete fixo (R$)</Label>
          <Input
            id="shipping"
            value={form.shippingFlatCents}
            onChange={(e) =>
              setForm((s) => ({ ...s, shippingFlatCents: e.target.value }))
            }
          />
        </div>
        <div>
          <Label htmlFor="freeShipping">Frete grátis a partir de (R$)</Label>
          <Input
            id="freeShipping"
            value={form.freeShippingCents}
            onChange={(e) =>
              setForm((s) => ({ ...s, freeShippingCents: e.target.value }))
            }
          />
        </div>
        <div>
          <Label htmlFor="logoUrl">URL do logo</Label>
          <Input
            id="logoUrl"
            value={form.logoUrl}
            onChange={(e) =>
              setForm((s) => ({ ...s, logoUrl: e.target.value }))
            }
          />
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar configurações"}
        </Button>
      </form>
    </div>
  );
}
