"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Plus } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, LoadingState } from "@ishopine/ui";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AffLink = {
  id: string;
  code: string;
  url?: string;
  clicks?: number;
  label?: string;
  product?: { name: string; slug?: string };
  shop?: { name: string; slug?: string };
};

export default function AffiliateLinksPage() {
  const [links, setLinks] = useState<AffLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [productId, setProductId] = useState("");
  const [creating, setCreating] = useState(false);
  const marketplace =
    process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3000";

  async function load() {
    setLoading(true);
    try {
      const data = await api<AffLink[]>("/affiliate/links");
      setLinks(Array.isArray(data) ? data : []);
    } catch {
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success("Link copiado");
    setTimeout(() => setCopied(null), 1500);
  };

  async function createLink() {
    if (!productId.trim()) {
      toast.error("Indique o ID do produto");
      return;
    }
    setCreating(true);
    try {
      await api("/affiliate/links", {
        method: "POST",
        body: JSON.stringify({ productId: productId.trim() }),
      });
      toast.success("Link criado");
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Meus links</h1>
        <p className="text-sm text-[var(--brand-muted)]">
          Links de afiliado — partilha e acompanha cliques.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-[var(--brand-border)] bg-white p-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="text-xs font-medium text-[var(--brand-muted)]">
            ID do produto
          </label>
          <Input
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            placeholder="cuid do produto no marketplace"
            className="mt-1"
          />
        </div>
        <Button onClick={() => void createLink()} disabled={creating}>
          <Plus className="mr-1 size-4" />
          Criar link
        </Button>
      </div>

      {loading ? (
        <LoadingState label="A carregar links" variant="skeleton" />
      ) : links.length === 0 ? (
        <EmptyState
          title="Sem links de afiliado"
          description="Crie um link com o ID de um produto para começar a acompanhar cliques."
        />
      ) : (
        <ul className="space-y-3">
          {links.map((link) => {
            const path = link.product?.slug
              ? `/produtos/${link.product.slug}`
              : link.shop?.slug
                ? `/lojas/${link.shop.slug}`
                : "/produtos";
            const url = `${marketplace}${path}?ref=${link.code}`;
            return (
              <li
                key={link.id}
                className="flex flex-col gap-2 rounded-2xl border border-[var(--brand-border)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {link.product?.name ||
                      link.shop?.name ||
                      link.label ||
                      `Código ${link.code}`}
                  </p>
                  <p className="truncate text-xs text-[var(--brand-muted)]">
                    {url}
                  </p>
                  <p className="mt-1 text-xs text-[var(--brand-muted)]">
                    {link.clicks ?? 0} cliques · {link.code}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copy(url, link.id)}
                  className="inline-flex items-center gap-1.5 self-start rounded-full border border-[var(--brand-border)] px-3 py-1.5 text-sm hover:bg-[var(--brand-orange-soft)]"
                >
                  {copied === link.id ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Copiar
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
