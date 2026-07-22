"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gift, Link2, TrendingUp } from "lucide-react";
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

  useEffect(() => {
    api<Summary>("/affiliate/summary")
      .then(setSummary)
      .catch(() => setSummary({}));
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
              className="rounded-2xl border border-[var(--brand-border)] bg-white p-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--brand-muted)]">{card.label}</p>
                <Icon className="h-4 w-4 text-[var(--brand-orange)]" />
              </div>
              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {card.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/links"
          className="rounded-full bg-[var(--brand-orange)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--brand-orange-hover)]"
        >
          Gerir links
        </Link>
        <Link
          href="/recompensas"
          className="rounded-full border border-[var(--brand-border)] bg-white px-5 py-2.5 text-sm font-medium hover:bg-[var(--brand-orange-soft)]"
        >
          Ver recompensas
        </Link>
      </div>
    </div>
  );
}
