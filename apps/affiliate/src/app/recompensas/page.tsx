"use client";

import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { api } from "@/lib/api";

type Summary = {
  commissionsCents?: number;
  pendingCents?: number;
  paidCents?: number;
};

export default function AffiliateRewardsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    api<Summary>("/affiliate/summary")
      .then(setSummary)
      .catch(() => setSummary({}));
  }, []);

  const total = summary?.commissionsCents ?? 0;
  const pending = summary?.pendingCents ?? 0;
  const paid = summary?.paidCents ?? 0;
  const empty = total === 0 && pending === 0 && paid === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Recompensas</h1>
        <p className="text-sm text-[var(--brand-muted)]">
          Comissões e prémios do programa de afiliados.
        </p>
      </div>

      {empty ? (
        <div className="rounded-2xl border border-dashed border-[var(--brand-border)] bg-white p-10 text-center">
          <Gift className="mx-auto h-8 w-8 text-[var(--brand-orange)]" />
          <p className="mt-3 text-[var(--brand-muted)]">
            Sem recompensas ainda. Continua a partilhar os teus links.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {[
            { label: "Total acumulado", cents: total },
            { label: "Pendente", cents: pending },
            { label: "Pago", cents: paid },
          ].map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between rounded-xl border border-[var(--brand-border)] bg-white px-4 py-3"
            >
              <p className="font-medium">{row.label}</p>
              <span className="font-semibold tabular-nums text-[var(--brand-orange)]">
                {(row.cents / 100).toLocaleString("pt-MZ")} MZN
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
