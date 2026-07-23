"use client";

import { useCallback, useEffect, useState } from "react";
import { Banner, Badge, Card, PageHeader } from "@ishopine/ui";
import { getApiBase } from "@/lib/api";

type HealthRow = {
  name: string;
  path: string;
  ok: boolean | null;
  detail: string;
};

const CHECKS: Array<{ name: string; path: string }> = [
  { name: "API shell", path: "/health" },
  { name: "Auth", path: "/auth/health" },
  { name: "Catalog", path: "/catalog/health" },
  { name: "Commerce", path: "/commerce/health" },
  { name: "Orders", path: "/orders/health" },
  { name: "Cart", path: "/cart/health" },
  { name: "Wallet", path: "/wallet/health" },
  { name: "Billing", path: "/billing/health" },
  { name: "Media", path: "/media/health" },
  { name: "Shops", path: "/shops/health" },
  { name: "Platform ops", path: "/platform-ops/health" },
];

export default function ObservabilityPage() {
  const [rows, setRows] = useState<HealthRow[]>(
    CHECKS.map((c) => ({ ...c, ok: null, detail: "…" })),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    const base = getApiBase();
    const next: HealthRow[] = [];
    for (const check of CHECKS) {
      const url = `${base}/api${check.path}`;
      try {
        const res = await fetch(url, {
          credentials: "include",
          cache: "no-store",
        });
        const text = await res.text();
        let detail = text.slice(0, 120);
        try {
          const json = JSON.parse(text) as { status?: string; service?: string };
          detail = json.service
            ? `${json.status ?? "ok"} · ${json.service}`
            : json.status ?? detail;
        } catch {
          /* keep text */
        }
        next.push({ ...check, ok: res.ok, detail: detail || res.statusText });
      } catch (e) {
        next.push({
          ...check,
          ok: false,
          detail: e instanceof Error ? e.message : "falha",
        });
      }
    }
    setRows(next);
    if (next.every((r) => r.ok === false)) {
      setError(
        "Nenhum serviço respondeu. Verifique NEXT_PUBLIC_API_URL e se o gateway/stranglers estão no ar.",
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const healthy = rows.filter((r) => r.ok === true).length;
  const total = rows.length;

  return (
    <div>
      <PageHeader
        title="Observabilidade"
        subtitle="Health checks dos stranglers e do shell Nest (leitura em tempo real)."
        primaryAction={{
          label: loading ? "A verificar…" : "Atualizar",
          onClick: () => void run(),
          disabled: loading,
        }}
      />

      {error ? (
        <div className="mb-4">
          <Banner tone="warning" title="Ligação incompleta">
            {error}
          </Banner>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Badge tone={healthy === total ? "success" : healthy === 0 ? "critical" : "warning"}>
          {healthy}/{total} saudáveis
        </Badge>
        <span className="text-sm text-[var(--ds-text-secondary)]">
          Via {getApiBase()}
        </span>
      </div>

      <Card padding="none">
        <ul className="divide-y divide-[var(--ds-border-subdued)]">
          {rows.map((row) => (
            <li
              key={row.path}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-[var(--ds-text)]">{row.name}</p>
                <p className="font-mono text-xs text-[var(--ds-text-secondary)]">
                  {row.path}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="max-w-xs truncate text-xs text-[var(--ds-text-secondary)]">
                  {row.detail}
                </span>
                {row.ok === null ? (
                  <Badge>…</Badge>
                ) : row.ok ? (
                  <Badge tone="success">OK</Badge>
                ) : (
                  <Badge tone="critical">DOWN</Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
