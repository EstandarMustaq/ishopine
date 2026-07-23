"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Card, CardTitle } from "@ishopine/ui";
import { api } from "@/lib/api";
import { formatMZN } from "@/lib/format";
import type { DashboardOverview } from "@/lib/types";

export default function BackofficeHomePage() {
  const [data, setData] = useState<DashboardOverview | null>(null);

  useEffect(() => {
    api<DashboardOverview>("/dashboard/overview")
      .then(setData)
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Erro ao carregar"),
      );
  }, []);

  const kpis = data?.kpis;

  return (
    <div>
      <PageHeader
        title="Home"
        description="Operabilidade da plataforma — só equipa iShopine."
      />
      {!data ? (
        <p className="text-[14px] text-[var(--ds-text-secondary)]">A carregar…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "GMV", value: formatMZN(kpis?.gmvCents ?? 0) },
            { label: "Pedidos", value: String(kpis?.orderCount ?? "—") },
            { label: "Lojas", value: String(kpis?.activeShops ?? kpis?.shopCount ?? "—") },
            { label: "Vendedores", value: String(kpis?.sellerCount ?? "—") },
          ].map((c) => (
            <Card key={c.label}>
              <p className="text-[12px] font-medium uppercase tracking-wide text-[var(--ds-text-secondary)]">
                {c.label}
              </p>
              <CardTitle className="mt-2 text-[22px]">{c.value}</CardTitle>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
