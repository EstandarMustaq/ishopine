"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Search } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatMZN } from "@/lib/format";
import type { Paginated, Product } from "@/lib/types";

const MARKETPLACE =
  process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3000";

export default function MobileSearchPage() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!debounced) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiFetch<Paginated<Product>>(
      `/products?q=${encodeURIComponent(debounced)}&limit=24`,
      { token: null },
    )
      .then((d) => {
        if (!cancelled) setProducts(d.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  return (
    <div className="px-4 py-4">
      <h1 className="text-[20px] font-semibold text-[var(--ds-text)]">Buscar</h1>
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--ds-text-secondary)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Produtos, lojas…"
          className="h-11 w-full rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-white pl-10 pr-3 text-[15px] outline-none focus:border-[var(--ds-brand)] focus:ring-2 focus:ring-[var(--ds-brand)]/20"
          autoFocus
        />
      </div>

      <div className="mt-4">
        {!debounced ? (
          <p className="text-[14px] text-[var(--ds-text-secondary)]">
            Escreva para encontrar produtos no marketplace.
          </p>
        ) : loading ? (
          <p className="text-[14px] text-[var(--ds-text-secondary)]">A procurar…</p>
        ) : products.length === 0 ? (
          <p className="text-[14px] text-[var(--ds-text-secondary)]">
            Nenhum resultado para “{debounced}”.
          </p>
        ) : (
          <ul className="space-y-2">
            {products.map((p) => {
              const href = `${MARKETPLACE}/produtos/${p.slug || p.id}`;
              const img = p.images?.[0]?.url;
              return (
                <li key={p.id}>
                  <a
                    href={href}
                    className="flex gap-3 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-subdued)] bg-white p-2 shadow-[var(--ds-shadow-raised)]"
                  >
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-[var(--ds-radius-sm)] bg-[var(--ds-bg)]">
                      {img ? (
                        <Image src={img} alt="" fill className="object-cover" sizes="64px" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 py-0.5">
                      <p className="truncate text-[14px] font-medium">{p.name}</p>
                      <p className="mt-1 text-[13px] font-semibold text-[var(--ds-brand)]">
                        {formatMZN(p.priceCents ?? 0)}
                      </p>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
