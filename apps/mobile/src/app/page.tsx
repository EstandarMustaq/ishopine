"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { apiFetch } from "@/lib/api";
import { formatMZN } from "@/lib/format";
import type { Paginated, Product } from "@/lib/types";

const MARKETPLACE =
  process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3000";

export default function MobileHomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Paginated<Product>>("/products?featured=true&limit=12&sort=newest", {
      token: null,
    })
      .then((d) => setProducts(d.items ?? []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <section className="relative overflow-hidden bg-[var(--ds-brand-dark)] px-4 pb-10 pt-8 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 60% at 100% 0%, rgba(0,128,96,0.9), transparent 55%), radial-gradient(ellipse 50% 40% at 0% 100%, rgba(0,112,217,0.35), transparent 50%)",
          }}
        />
        <div className="relative">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/70">
            iShopine
          </p>
          <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-tight">
            Compre em Moçambique
          </h1>
          <p className="mt-2 max-w-sm text-[14px] text-white/80">
            M-Pesa, e-Mola e cartão. Entrega local.
          </p>
          <a
            href={`${MARKETPLACE}/produtos`}
            className="mt-5 inline-flex min-h-11 items-center rounded-[var(--ds-radius-sm)] bg-white px-4 text-[14px] font-semibold text-[var(--ds-brand-dark)]"
          >
            Explorar mercado
          </a>
        </div>
      </section>

      <section className="px-4 py-6">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-[16px] font-semibold text-[var(--ds-text)]">
            Em destaque
          </h2>
          <a
            href={`${MARKETPLACE}/produtos`}
            className="text-[13px] font-medium text-[var(--ds-brand)]"
          >
            Ver tudo
          </a>
        </div>

        {loading ? (
          <p className="text-[14px] text-[var(--ds-text-secondary)]">A carregar…</p>
        ) : products.length === 0 ? (
          <div className="rounded-[var(--ds-radius-md)] border border-dashed border-[var(--ds-border)] bg-white p-8 text-center">
            <p className="text-[14px] text-[var(--ds-text-secondary)]">
              Sem produtos em destaque. Abra o marketplace completo.
            </p>
            <a
              href={MARKETPLACE}
              className="mt-3 inline-block text-[14px] font-medium text-[var(--ds-brand)]"
            >
              Ir ao iShopine →
            </a>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {products.map((p) => {
              const href = `${MARKETPLACE}/produtos/${p.slug || p.id}`;
              const img =
                p.images?.[0]?.url ||
                "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=60";
              return (
                <li key={p.id}>
                  <a
                    href={href}
                    className="block overflow-hidden rounded-[var(--ds-radius-md)] border border-[var(--ds-border-subdued)] bg-white shadow-[var(--ds-shadow-raised)]"
                  >
                    <div className="relative aspect-square bg-[var(--ds-bg)]">
                      <Image
                        src={img}
                        alt={p.name}
                        fill
                        className="object-cover"
                        sizes="160px"
                      />
                    </div>
                    <div className="p-2.5">
                      <p className="line-clamp-2 text-[13px] font-medium text-[var(--ds-text)]">
                        {p.name}
                      </p>
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
      </section>
    </div>
  );
}
