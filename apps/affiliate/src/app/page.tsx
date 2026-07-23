"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gift, Link2, TrendingUp } from "lucide-react";
import { LoadingState } from "@ishopine/ui";
import { api } from "@/lib/api";

type Summary = {
  activeLinks?: number;
  linksCount?: number;
  clicks?: number;
  pendingCents?: number;
  earnedCents?: number;
  commissionsCents?: number;
  paidCents?: number;
};

export default function AffiliateHomePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Summary>("/affiliate/summary")
      .then(setSummary)
      .catch(() => setSummary({}))
      .finally(() => setLoading(false));
  }, []);

  const links = summary?.activeLinks ?? summary?.linksCount ?? 0;
  const clicks = summary?.clicks ?? 0;
  const commissions =
    (summary?.commissionsCents ??
      (summary?.pendingCents ?? 0) + (summary?.earnedCents ?? 0)) / 100;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-[var(--brand-ink)]">
          Programa de afiliados
        </h1>
        <p className="mt-1 text-[var(--brand-muted)]">
          Partilha links e ganha comissões nas vendas.
        </p>
      </div>

      {loading ? (
        <LoadingState label="A carregar resumo" variant="skeleton" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Links activos", value: links, icon: Link2 },
            { label: "Cliques", value: clicks, icon: TrendingUp },
            {
              label: "Comissões (MZN)",
              value: commissions.toLocaleString("pt-MZ"),
              icon: Gift,
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border-subdued)] bg-white p-5 shadow-[var(--ds-shadow-raised)]"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[var(--brand-muted)]">{card.label}</p>
                  <Icon className="h-4 w-4 text-[var(--ds-brand)]" />
                </div>
                <p className="mt-2 text-3xl font-semibold tabular-nums">
                  {card.value}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href="/links"
          className="rounded-[var(--ds-radius-sm)] bg-[var(--ds-brand)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--ds-brand-dark)]"
        >
          Gerir links
        </Link>
        <Link
          href="/recompensas"
          className="rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-white px-5 py-2.5 text-sm font-medium hover:bg-[var(--ds-bg)]"
        >
          Ver recompensas
        </Link>
      </div>
    </div>
  );
}
