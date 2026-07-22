"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, getApiBase } from "@/lib/api";
import { formatMZN, formatDateTime } from "@/lib/format";
import { useTenantStore } from "@/lib/tenant-store";

type ShipmentRow = {
  id: string;
  orderId: string;
  carrierCode: string;
  method: string;
  status: string;
  trackingCode?: string | null;
  labelUrl?: string | null;
  amountCents: number;
  createdAt: string;
  order?: { orderNumber: string; status: string };
};

export default function EnviosPage() {
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const [rows, setRows] = useState<ShipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [trackingByOrder, setTrackingByOrder] = useState<
    Record<string, string>
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<ShipmentRow[]>("/logistics/shipments");
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar envios",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, activeTenantId]);

  async function createLabel(orderId: string, carrierCode: string) {
    const needsManual = carrierCode === "MANUAL";
    const trackingCode = trackingByOrder[orderId]?.trim();
    if (needsManual && !trackingCode) {
      toast.error("Indique o código de tracking do transportador");
      return;
    }
    setBusy(orderId);
    try {
      await api(`/logistics/shipments/${orderId}/label`, {
        method: "POST",
        body: JSON.stringify(
          needsManual
            ? { trackingCode }
            : { trackingCode: trackingCode || undefined },
        ),
      });
      toast.success("Etiqueta gerada");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro na etiqueta",
      );
    } finally {
      setBusy(null);
    }
  }

  function labelHref(s: ShipmentRow) {
    if (s.labelUrl?.startsWith("http")) return s.labelUrl;
    const path = s.labelUrl || `/api/logistics/shipments/${s.id}/label`;
    return `${getApiBase()}${path.startsWith("/") ? path : `/${path}`}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Envios</h1>
        <p className="mt-1 text-sm text-taupe">
          Remessas com tarifas por zona, etiquetas imprimíveis e tracking.
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-taupe">A carregar…</p>
      ) : (
        <ul className="divide-y rounded-2xl border bg-white">
          {rows.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-taupe">
              Sem envios. Criam-se automaticamente no checkout.
            </li>
          ) : (
            rows.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {s.order?.orderNumber ?? s.orderId.slice(0, 8)}
                  </p>
                  <p className="text-xs text-taupe">
                    {s.carrierCode} · {s.method} · {s.status}
                    {s.trackingCode ? ` · ${s.trackingCode}` : ""}
                  </p>
                  <p className="text-xs text-taupe">
                    {formatMZN(s.amountCents)} ·{" "}
                    {formatDateTime(s.createdAt)}
                  </p>
                </div>
                {!s.trackingCode ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {s.carrierCode === "MANUAL" ? (
                      <input
                        className="h-9 rounded-md border px-2 text-sm"
                        placeholder="Tracking do transportador"
                        value={trackingByOrder[s.orderId] ?? ""}
                        onChange={(e) =>
                          setTrackingByOrder((prev) => ({
                            ...prev,
                            [s.orderId]: e.target.value,
                          }))
                        }
                      />
                    ) : null}
                    <Button
                      size="sm"
                      disabled={busy === s.orderId}
                      onClick={() =>
                        void createLabel(s.orderId, s.carrierCode)
                      }
                    >
                      Gerar etiqueta
                    </Button>
                  </div>
                ) : (
                  <a
                    className="text-sm font-medium underline"
                    href={labelHref(s)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Imprimir etiqueta
                  </a>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
