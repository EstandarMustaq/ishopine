"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatMZN } from "@/lib/format";
import { useTenantStore } from "@/lib/tenant-store";

type WalletPayload = {
  wallet: {
    id: string;
    availableCents: number;
    heldCents: number;
    currency: string;
  } | null;
  ledger: Array<{
    id: string;
    type: string;
    amountCents: number;
    note?: string | null;
    createdAt: string;
  }>;
};

type UsagePayload = {
  periodKey: string;
  subscription?: {
    status: string;
    plan: { code: string; name: string };
  } | null;
  usage: Array<{ metric: string; quantity: number }>;
};

type Plan = {
  code: string;
  name: string;
  description?: string | null;
  monthlyPriceCents: number;
  includedOrders: number | null;
  overageOrderCents: number;
};

export default function SellerCarteiraPage() {
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const [wallet, setWallet] = useState<WalletPayload | null>(null);
  const [usage, setUsage] = useState<UsagePayload | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [w, u, p] = await Promise.all([
        api<WalletPayload>("/wallet/tenant").catch(() =>
          api<WalletPayload>("/wallet/me"),
        ),
        api<UsagePayload>("/billing/usage").catch(() => null),
        api<Plan[]>("/pricing/plans").catch(() => []),
      ]);
      setWallet(w);
      setUsage(u);
      setPlans(Array.isArray(p) ? p : []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar carteira",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, activeTenantId]);

  async function subscribe(planCode: string) {
    setSubscribing(planCode);
    try {
      await api("/subscriptions", {
        method: "POST",
        body: JSON.stringify({ planCode }),
      });
      toast.success(`Plano ${planCode} activado`);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao mudar de plano",
      );
    } finally {
      setSubscribing(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-taupe">A carregar carteira e planos…</p>;
  }

  const bal = wallet?.wallet?.availableCents ?? 0;
  const orders =
    usage?.usage.find((u) => u.metric === "ORDERS")?.quantity ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Carteira & planos</h1>
        <p className="mt-1 text-sm text-taupe">
          Saldo do tenant (vendas liquidadas), uso e planos premium.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-taupe">Disponível</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {formatMZN(bal)}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-taupe">Plano</p>
          <p className="mt-2 text-xl font-semibold">
            {usage?.subscription?.plan.name ?? "—"}
          </p>
          <p className="text-xs text-taupe">
            {usage?.subscription?.status ?? "sem subscrição"}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-taupe">
            Pedidos ({usage?.periodKey ?? "—"})
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{orders}</p>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold">Planos</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.code}
              className="flex flex-col rounded-2xl border bg-white p-4"
            >
              <p className="font-semibold">{plan.name}</p>
              <p className="mt-1 text-xs text-taupe">{plan.description}</p>
              <p className="mt-3 text-xl font-semibold tabular-nums">
                {plan.code === "ENTERPRISE" && plan.monthlyPriceCents === 0
                  ? "Custom"
                  : formatMZN(plan.monthlyPriceCents)}
                <span className="text-xs font-normal text-taupe"> /mês</span>
              </p>
              <p className="mt-1 text-xs text-taupe">
                {plan.includedOrders == null
                  ? "Pedidos ilimitados"
                  : `${plan.includedOrders} pedidos · +${formatMZN(plan.overageOrderCents)} extra`}
              </p>
              <button
                type="button"
                disabled={subscribing === plan.code}
                onClick={() => void subscribe(plan.code)}
                className="mt-4 rounded-full bg-[var(--brand-orange)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {subscribing === plan.code ? "…" : "Escolher"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Movimentos</h2>
        <ul className="mt-3 divide-y rounded-2xl border bg-white">
          {(wallet?.ledger ?? []).length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-taupe">
              Sem movimentos. O saldo cresce quando vendas são pagas.
            </li>
          ) : (
            (wallet?.ledger ?? []).map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{e.note || e.type}</p>
                  <p className="text-xs text-taupe">
                    {new Date(e.createdAt).toLocaleString("pt-MZ")}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">
                  {e.type === "DEBIT" || e.type === "HOLD" ? "−" : "+"}
                  {formatMZN(e.amountCents)}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
