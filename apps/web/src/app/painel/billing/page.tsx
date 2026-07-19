"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { BillingPayment, Paginated } from "@/lib/types";

function statusTone(status: string) {
  const s = status.toUpperCase();
  if (s === "PAID") return "bg-emerald-50 text-emerald-800 border-emerald-200/60";
  if (s === "FAILED" || s === "CANCELLED")
    return "bg-red-50 text-red-800 border-red-200/60";
  if (s === "PROCESSING" || s === "PENDING")
    return "bg-zinc-100 text-zinc-700 border-zinc-200/60";
  return "bg-zinc-50 text-zinc-600 border-zinc-200/60";
}

export default function PainelBillingPage() {
  const [payments, setPayments] = useState<BillingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setUnavailable(false);
    try {
      const data = await api<
        BillingPayment[] | Paginated<BillingPayment> | { items: BillingPayment[] }
      >("/billing/payments");
      if (Array.isArray(data)) {
        setPayments(data);
      } else if (data && "items" in data) {
        setPayments(data.items ?? []);
      } else {
        setPayments([]);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao carregar pagamentos";
      if (
        /404|not found|não encontrad/i.test(message) ||
        message === "Not Found"
      ) {
        setUnavailable(true);
        setPayments([]);
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
        Pagamentos
      </h1>
      <p className="mt-1 text-[13px] text-zinc-500">
        Histórico PaySuite — M-Pesa, e-Mola e cartões (MZN).
      </p>

      {loading && (
        <p className="mt-8 text-[13px] text-zinc-500">Carregando...</p>
      )}

      {!loading && unavailable && (
        <div className="glass-panel mt-8 px-5 py-10 text-center">
          <p className="text-[13px] text-zinc-500">
            O endpoint <span className="font-mono text-zinc-800">GET /billing/payments</span>{" "}
            ainda não está disponível.
          </p>
        </div>
      )}

      {!loading && !unavailable && payments.length === 0 && (
        <div className="glass-panel mt-8 px-5 py-10 text-center">
          <p className="text-[13px] text-zinc-500">
            Nenhum pagamento registado.
          </p>
        </div>
      )}

      {!loading && !unavailable && payments.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200/60 bg-white/70 shadow-glass backdrop-blur-xl">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-zinc-200/60 bg-zinc-50/80 text-[11px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Provedor</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-zinc-100/80 last:border-0"
                >
                  <td className="px-4 py-3 font-mono text-[12px] text-zinc-700">
                    {p.id.slice(0, 10)}…
                  </td>
                  <td className="px-4 py-3 text-zinc-800">{p.provider}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${statusTone(String(p.status))}`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {typeof p.amountCents === "number"
                      ? formatMoney(p.amountCents, p.currency || "MZN")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {p.createdAt
                      ? new Date(p.createdAt).toLocaleString("pt-MZ")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
