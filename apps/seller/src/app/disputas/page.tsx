"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Dispute, DisputeStatus } from "@/lib/types";

const statusLabel: Record<DisputeStatus, string> = {
  OPEN: "Aberta",
  IN_REVIEW: "Em análise",
  RESOLVED: "Resolvida",
  REJECTED: "Rejeitada",
  CLOSED: "Fechada",
};

export default function PainelDisputasPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api<Dispute[] | { items: Dispute[] }>("/disputes");
      setDisputes(Array.isArray(data) ? data : (data.items ?? []));
    } catch {
      setDisputes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal">Disputas</h1>
      <p className="mt-1 text-sm text-taupe">
        Acompanhe disputas abertas no mercado.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-taupe">Carregando...</p>
      ) : disputes.length === 0 ? (
        <div className="mt-8 rounded-[12px] bg-beige px-6 py-12 text-center">
          <p className="text-sm text-taupe">Nenhuma disputa no momento.</p>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {disputes.map((d) => (
            <li
              key={d.id}
              className="rounded-[12px] border border-border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-charcoal">{d.reason}</p>
                  <p className="mt-1 text-xs text-taupe">
                    Pedido {d.order?.orderNumber ?? d.orderId}
                    {d.user?.email ? ` · ${d.user.email}` : ""}
                    {" · "}
                    {formatDateTime(d.createdAt)}
                  </p>
                </div>
                <Badge variant="secondary">
                  {statusLabel[d.status] ?? d.status}
                </Badge>
              </div>
              <p className="mt-3 text-sm text-taupe">{d.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
