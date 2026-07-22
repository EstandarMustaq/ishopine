"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gift, Link2, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";

type AffLink = { id: string; clicks?: number };

export default function AffiliateHomePage() {
  const [stats, setStats] = useState({
    links: 0,
    clicks: 0,
    commissionsCents: 0,
  });

  useEffect(() => {
    Promise.allSettled([
      api<AffLink[]>("/affiliate/links"),
      api<{
        linksCount?: number;
        clicks?: number;
        commissionsCents?: number;
      }>("/affiliate/summary"),
    ]).then(([linksRes, summaryRes]) => {
      let links = 0;
      let clicks = 0;
      if (linksRes.status === "fulfilled") {
        const arr = Array.isArray(linksRes.value) ? linksRes.value : [];
        links = arr.length;
        clicks = arr.reduce((n, l) => n + (l.clicks || 0), 0);
      }
      if (summaryRes.status === "fulfilled") {
        const s = summaryRes.value;
        setStats({
          links: s.linksCount ?? links,
          clicks: s.clicks ?? clicks,
          commissionsCents: s.commissionsCents ?? 0,
        });
        return;
      }
      setStats({ links, clicks, commissionsCents: 0 });
    });
  }, []);

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
          { label: "Links activos", value: stats.links, icon: Link2 },
          { label: "Cliques", value: stats.clicks, icon: TrendingUp },
          {
            label: "Comissões (MZN)",
            value: (stats.commissionsCents / 100).toLocaleString("pt-MZ"),
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
