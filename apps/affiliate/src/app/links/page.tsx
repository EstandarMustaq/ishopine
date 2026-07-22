"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

type AffLink = {
  id: string;
  code: string;
  url?: string;
  clicks?: number;
  label?: string;
  product?: { name: string };
};

export default function AffiliateLinksPage() {
  const [links, setLinks] = useState<AffLink[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const marketplace =
    process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3000";

  useEffect(() => {
    api<AffLink[]>("/affiliate/links")
      .then((data) => setLinks(Array.isArray(data) ? data : []))
      .catch(() => setLinks([]));
  }, []);

  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success("Link copiado");
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Meus links</h1>
        <p className="text-sm text-[var(--brand-muted)]">
          Links de afiliado associados à tua conta.
        </p>
      </div>

      {links.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--brand-border)] bg-white p-8 text-center text-[var(--brand-muted)]">
          Ainda não tens links. Cria a partir de um produto no marketplace.
        </p>
      ) : (
        <ul className="space-y-3">
          {links.map((link) => {
            const url =
              link.url || `${marketplace}/produtos?ref=${link.code}`;
            return (
              <li
                key={link.id}
                className="flex flex-col gap-2 rounded-2xl border border-[var(--brand-border)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {link.product?.name || link.label || `Código ${link.code}`}
                  </p>
                  <p className="truncate text-xs text-[var(--brand-muted)]">
                    {url}
                  </p>
                  <p className="mt-1 text-xs text-[var(--brand-muted)]">
                    {link.clicks ?? 0} cliques
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
