"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, LoadingState } from "@ishopine/ui";
import { AuthGate } from "@/components/dashboard/auth-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatMZN, formatDate } from "@/lib/format";
import type { Coupon } from "@/lib/types";

export default function PainelCuponsPage() {
  return (
    <AuthGate adminOnly>
      <CuponsContent />
    </AuthGate>
  );
}

function CuponsContent() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    code: "",
    description: "",
    discountType: "PERCENT" as "PERCENT" | "FIXED",
    discountValue: "",
    minSubtotalCents: "",
    maxUses: "",
  });

  const load = useCallback(async () => {
    try {
      const data = await api<Coupon[] | { items: Coupon[] }>("/coupons");
      setCoupons(Array.isArray(data) ? data : (data.items ?? []));
    } catch {
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const discountValue = Number(form.discountValue.replace(",", "."));
      await api("/coupons", {
        method: "POST",
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          description: form.description || undefined,
          discountType: form.discountType,
          discountValue:
            form.discountType === "FIXED"
              ? Math.round(discountValue * 100)
              : discountValue,
          minSubtotalCents: form.minSubtotalCents
            ? Math.round(
                Number(form.minSubtotalCents.replace(",", ".")) * 100,
              )
            : undefined,
          maxUses: form.maxUses ? Number(form.maxUses) : undefined,
          isActive: true,
        }),
      });
      toast.success("Cupom criado");
      setForm({
        code: "",
        description: "",
        discountType: "PERCENT",
        discountValue: "",
        minSubtotalCents: "",
        maxUses: "",
      });
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao criar cupom",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal">Cupons</h1>
      <p className="mt-1 text-sm text-taupe">
        Gerencie códigos de desconto do iShopine.
      </p>

      <form
        onSubmit={onCreate}
        className="mt-8 max-w-xl space-y-4 rounded-[12px] border border-border p-5"
      >
        <h2 className="font-semibold">Novo cupom</h2>
        <div>
          <Label htmlFor="code">Código</Label>
          <Input
            id="code"
            required
            value={form.code}
            onChange={(e) =>
              setForm((s) => ({ ...s, code: e.target.value.toUpperCase() }))
            }
            placeholder="BEMVINDO10"
          />
        </div>
        <div>
          <Label htmlFor="description">Descrição</Label>
          <Input
            id="description"
            value={form.description}
            onChange={(e) =>
              setForm((s) => ({ ...s, description: e.target.value }))
            }
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Tipo</Label>
            <Select
              value={form.discountType}
              onValueChange={(v) =>
                setForm((s) => ({
                  ...s,
                  discountType: v as "PERCENT" | "FIXED",
                }))
              }
            >
              <SelectTrigger className="mt-1 h-11 rounded-[16px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERCENT">Percentual (%)</SelectItem>
                <SelectItem value="FIXED">Valor fixo (MZN)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="discountValue">
              {form.discountType === "PERCENT" ? "Percentual" : "Valor (MZN)"}
            </Label>
            <Input
              id="discountValue"
              required
              value={form.discountValue}
              onChange={(e) =>
                setForm((s) => ({ ...s, discountValue: e.target.value }))
              }
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="minSubtotal">Mínimo do pedido (MZN)</Label>
            <Input
              id="minSubtotal"
              value={form.minSubtotalCents}
              onChange={(e) =>
                setForm((s) => ({ ...s, minSubtotalCents: e.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor="maxUses">Usos máximos</Label>
            <Input
              id="maxUses"
              value={form.maxUses}
              onChange={(e) =>
                setForm((s) => ({ ...s, maxUses: e.target.value }))
              }
            />
          </div>
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Salvando..." : "Criar cupom"}
        </Button>
      </form>

      <h2 className="mt-10 text-xl font-semibold">Cupons cadastrados</h2>
      {loading ? (
        <LoadingState
          label="A carregar cupons"
          variant="skeleton"
          className="mt-4"
        />
      ) : coupons.length === 0 ? (
        <EmptyState
          className="mt-4"
          title="Sem cupons"
          description="Crie códigos de desconto para campanhas do marketplace."
        />
      ) : (
        <ul className="mt-4 space-y-3">
          {coupons.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-border p-4"
            >
              <div>
                <p className="font-mono font-semibold text-[#111111]">
                  {c.code}
                </p>
                <p className="mt-1 text-sm text-taupe">
                  {c.discountType === "PERCENT"
                    ? `${c.discountValue}%`
                    : formatMZN(c.discountValue)}
                  {c.description ? ` · ${c.description}` : ""}
                </p>
                {c.createdAt && (
                  <p className="mt-1 text-xs text-taupe">
                    Criado em {formatDate(c.createdAt)}
                  </p>
                )}
              </div>
              <Badge variant={c.isActive ? "default" : "secondary"}>
                {c.isActive ? "Ativo" : "Inativo"}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
