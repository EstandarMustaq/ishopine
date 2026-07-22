"use client";

import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { api } from "@/lib/api";

type Reward = {
  id: string;
  amountCents: number;
  status: string;
  orderId?: string | null;
  createdAt: string;
  link?: {
    code: string;
    product?: { name: string } | null;
    shop?: { name: string } | null;
  };
};

type Summary = {
  pendingCents?: number;
  earnedCents?: number;
  commissionsCents?: number;
  paidCents?: number;
};

export default function AffiliateRewardsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);

  useEffect(() => {
    Promise.allSettled([
      api<Summary>("/affiliate/summary"),
      api<Reward[]>("/affiliate/rewards"),
    ]).then(([sumRes, rewardsRes]) => {
      if (sumRes.status === "fulfilled") setSummary(sumRes.value);
      if (rewardsRes.status === "fulfilled") {
        setRewards(Array.isArray(rewardsRes.value) ? rewardsRes.value : []);
      }
    });
  }, []);

  const pending = summary?.pendingCents ?? 0;
  const paid = summary?.paidCents ?? summary?.earnedCents ?? 0;
  const total = summary?.commissionsCents ?? pending + paid;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Recompensas</h1>
        <p className="text-sm text-[var(--brand-muted)]">
          Comissões geradas quando um comprador paga com o teu link.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total", cents: total },
          { label: "Pendente", cents: pending },
          { label: "Creditado", cents: paid },
        ].map((row) => (
          <div
            key={row.label}
            className="rounded-xl border border-[var(--brand-border)] bg-white px-4 py-3"
          >
            <p className="text-xs text-[var(--brand-muted)]">{row.label}</p>
            <p className="mt-1 font-semibold tabular-nums text-[var(--brand-orange)]">
              {(row.cents / 100).toLocaleString("pt-MZ")} MZN
            </p>
          </div>
        ))}
      </div>

      {rewards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--brand-border)] bg-white p-10 text-center">
          <Gift className="mx-auto h-8 w-8 text-[var(--brand-orange)]" />
          <p className="mt-3 text-[var(--brand-muted)]">
            Sem recompensas ainda. Continua a partilhar os teus links.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rewards.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-xl border border-[var(--brand-border)] bg-white px-4 py-3"
            >
              <div>
                <p className="font-medium">
                  {r.link?.product?.name ||
                    r.link?.shop?.name ||
                    `Código ${r.link?.code ?? "—"}`}
                </p>
                <p className="text-xs text-[var(--brand-muted)]">
                  {r.status}
                  {r.createdAt
                    ? ` · ${new Date(r.createdAt).toLocaleDateString("pt-MZ")}`
                    : ""}
                </p>
              </div>
              <span className="font-semibold tabular-nums text-[var(--brand-orange)]">
                {(r.amountCents / 100).toLocaleString("pt-MZ")} MZN
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
