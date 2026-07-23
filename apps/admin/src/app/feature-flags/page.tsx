"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, LoadingState } from "@ishopine/ui";
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
    <div className="space-y-6 text-[var(--ds-text)]">
      <div>
        <h1 className="text-2xl font-semibold">Feature flags</h1>
        <p className="mt-1 text-sm text-[var(--ds-text-secondary)]">
          Controlo global (overrides por tenant/plano via API).
        </p>
      </div>
      {loading ? (
        <LoadingState label="A carregar flags" variant="skeleton" />
      ) : flags.length === 0 ? (
        <EmptyState
          title="Sem feature flags"
          description="As flags configuradas pela plataforma aparecerão aqui."
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--ds-radius-md)] border border-[var(--ds-border-subdued)] bg-[var(--ds-surface)] shadow-[var(--ds-shadow-raised)]">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-[var(--ds-bg)] text-[var(--ds-text-secondary)]">
              <tr>
                <th className="px-4 py-3 font-medium">Key</th>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Acção</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => (
                <tr key={f.id} className="border-t border-[var(--ds-border-subdued)]">
                  <td className="px-4 py-3 font-mono text-xs">{f.key}</td>
                  <td className="px-4 py-3 text-[var(--ds-text-secondary)]">
                    {f.description || "—"}
                    {f.overrides.length > 0 ? (
                      <span className="ml-2 text-[10px] text-[var(--ds-text-disabled)]">
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
