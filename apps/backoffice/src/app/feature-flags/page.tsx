"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

type Flag = {
  id: string;
  key: string;
  description?: string | null;
  enabled: boolean;
  overrides: Array<{ id: string; scopeKey: string; enabled: boolean }>;
};

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<Flag[]>("/feature-flags");
      setFlags(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar flags",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(key: string, enabled: boolean) {
    try {
      await api(`/feature-flags/${key}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });
      toast.success(`${key} → ${enabled ? "on" : "off"}`);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao actualizar flag",
      );
    }
  }

  return (
    <div className="space-y-6 text-white">
      <div>
        <h1 className="text-2xl font-semibold">Feature flags</h1>
        <p className="mt-1 text-sm text-white/60">
          Controlo global (overrides por tenant/plano via API).
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-white/50">A carregar…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-white/5 text-white/50">
              <tr>
                <th className="px-4 py-3 font-medium">Key</th>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Acção</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => (
                <tr key={f.id} className="border-t border-white/10">
                  <td className="px-4 py-3 font-mono text-xs">{f.key}</td>
                  <td className="px-4 py-3 text-white/70">
                    {f.description || "—"}
                    {f.overrides.length > 0 ? (
                      <span className="ml-2 text-[10px] text-white/40">
                        ({f.overrides.length} overrides)
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {f.enabled ? "ON" : "OFF"}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/20 bg-transparent text-white hover:bg-white/10"
                      onClick={() => void toggle(f.key, !f.enabled)}
                    >
                      {f.enabled ? "Desactivar" : "Activar"}
                    </Button>
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
