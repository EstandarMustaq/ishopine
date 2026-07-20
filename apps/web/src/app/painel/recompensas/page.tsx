"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Gift } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Message, MessageContent } from "@/components/ui/message";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatMZN } from "@/lib/format";

interface AffiliateSummary {
  eligible: boolean;
  activeLinks: number;
  pendingCents: number;
  earnedCents: number;
}

interface AffiliateLinkRow {
  id: string;
  code: string;
  label?: string | null;
  clicks: number;
  conversions: number;
  pendingCents: number;
  earnedCents: number;
  product?: { id: string; name: string; slug: string } | null;
  shop?: { id: string; name: string; slug: string } | null;
}

export default function RecompensasPage() {
  const user = useAuthStore((s) => s.user);
  const [summary, setSummary] = useState<AffiliateSummary | null>(null);
  const [links, setLinks] = useState<AffiliateLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [productId, setProductId] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, l] = await Promise.all([
        api<AffiliateSummary>("/affiliate/summary"),
        api<AffiliateLinkRow[]>("/affiliate/links"),
      ]);
      setSummary(s);
      setLinks(l);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar recompensas",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createLink(e: React.FormEvent) {
    e.preventDefault();
    if (!productId.trim()) {
      toast.error("Informe o ID do produto da empresa");
      return;
    }
    setCreating(true);
    try {
      await api("/affiliate/links", {
        method: "POST",
        body: JSON.stringify({ productId: productId.trim() }),
      });
      toast.success("Link de recompensa criado");
      setProductId("");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao criar link",
      );
    } finally {
      setCreating(false);
    }
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/produtos?ref=${code}`;
    void navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!user?.canBuy || (!user.emailVerifiedAt && !user.affiliateEligible)) {
    return (
      <Message>
        <MessageContent>
          Recompensas por indicação estão disponíveis apenas para clientes
          verificados e elegíveis na plataforma.
        </MessageContent>
      </Message>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2">
        <Gift className="size-5 text-zinc-700" />
        <h1 className="text-2xl font-bold text-charcoal">Recompensas</h1>
      </div>
      <p className="mt-1 text-sm text-taupe">
        Partilhe produtos de empresas/organizações no iShopine e ganhe
        recompensa quando houver venda pelo seu link.
      </p>

      {summary && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border p-4">
            <p className="text-[11px] uppercase tracking-wide text-zinc-400">
              Links activos
            </p>
            <p className="mt-1 text-xl font-semibold">{summary.activeLinks}</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-[11px] uppercase tracking-wide text-zinc-400">
              Pendente
            </p>
            <p className="mt-1 text-xl font-semibold">
              {formatMZN(summary.pendingCents)}
            </p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-[11px] uppercase tracking-wide text-zinc-400">
              Acumulado
            </p>
            <p className="mt-1 text-xl font-semibold">
              {formatMZN(summary.earnedCents)}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={createLink} className="mt-8 space-y-4 rounded-xl border border-border p-5">
        <Field>
          <FieldLabel htmlFor="productId">ID do produto</FieldLabel>
          <Input
            id="productId"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            placeholder="cm…"
          />
          <FieldDescription>
            Apenas produtos de lojas/empresas no iShopine. Use o ID interno do
            produto.
          </FieldDescription>
        </Field>
        <Button type="submit" disabled={creating}>
          {creating ? <Spinner className="size-4" /> : null}
          Criar link de recompensa
        </Button>
      </form>

      <ul className="mt-8 space-y-3">
        {links.map((link) => (
          <li
            key={link.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
          >
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                {link.product?.name || link.shop?.name || link.label || link.code}
              </p>
              <p className="mt-1 text-[12px] text-zinc-500">
                {link.clicks} cliques · {link.conversions} conversões ·{" "}
                {formatMZN(link.earnedCents)}
              </p>
              <p className="mt-1 font-mono text-[11px] text-zinc-400">
                ?ref={link.code}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => copyLink(link.code)}
            >
              <Copy className="size-3.5" />
              Copiar
            </Button>
          </li>
        ))}
        {links.length === 0 && (
          <p className="text-sm text-taupe">Ainda não tem links de recompensa.</p>
        )}
      </ul>
    </div>
  );
}
