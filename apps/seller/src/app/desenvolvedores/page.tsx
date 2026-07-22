"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useTenantStore } from "@/lib/tenant-store";

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt?: string | null;
  createdAt: string;
};

type WebhookRow = {
  id: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
};

export default function DevelopersPage() {
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const [enabled, setEnabled] = useState(true);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyName, setKeyName] = useState("Default");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = await api<{ enabled: boolean }>("/developers/status").catch(
        () => ({ enabled: false }),
      );
      setEnabled(status.enabled);
      if (!status.enabled) {
        setKeys([]);
        setWebhooks([]);
        return;
      }
      const [k, w] = await Promise.all([
        api<ApiKeyRow[]>("/developers/keys"),
        api<WebhookRow[]>("/developers/webhooks"),
      ]);
      setKeys(k);
      setWebhooks(w);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar API",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, activeTenantId]);

  async function createKey() {
    setBusy(true);
    try {
      const created = await api<ApiKeyRow & { apiKey: string }>(
        "/developers/keys",
        {
          method: "POST",
          body: JSON.stringify({ name: keyName }),
        },
      );
      setFreshKey(created.apiKey);
      toast.success("API key criada — copie agora");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao criar key",
      );
    } finally {
      setBusy(false);
    }
  }

  async function revokeKey(id: string) {
    setBusy(true);
    try {
      await api(`/developers/keys/${id}`, { method: "DELETE" });
      toast.success("Key revogada");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao revogar",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveWebhook() {
    setBusy(true);
    try {
      await api("/developers/webhooks", {
        method: "POST",
        body: JSON.stringify({ url: webhookUrl }),
      });
      toast.success("Webhook guardado");
      setWebhookUrl("");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro no webhook",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-taupe">
        <Spinner className="size-4" /> A carregar…
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="max-w-xl space-y-2">
        <h1 className="text-2xl font-bold text-charcoal">Developer Platform</h1>
        <p className="text-sm text-taupe">
          Feature flag <code>developer_platform</code> desactivada para este
          tenant. Contacte a equipa iShopine.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Developer Platform</h1>
        <p className="mt-1 text-sm text-taupe">
          API keys (<code>ish_live_…</code>) e webhooks assinados para o tenant
          STORE activo.
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border bg-white p-5">
        <h2 className="font-semibold">API keys</h2>
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="Nome"
          />
          <Button disabled={busy} onClick={() => void createKey()}>
            Criar key
          </Button>
        </div>
        {freshKey ? (
          <p className="rounded-lg bg-amber-50 p-3 text-xs break-all text-amber-900">
            Copie agora (só aparece uma vez): <strong>{freshKey}</strong>
          </p>
        ) : null}
        <ul className="divide-y rounded-xl border">
          {keys.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-taupe">
              Sem keys activas
            </li>
          ) : (
            keys.map((k) => (
              <li
                key={k.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{k.name}</p>
                  <p className="font-mono text-xs text-taupe">{k.keyPrefix}…</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void revokeKey(k.id)}
                >
                  Revogar
                </Button>
              </li>
            ))
          )}
        </ul>
        <p className="text-xs text-taupe">
          Exemplos: <code>GET /api/v1/products</code>,{" "}
          <code>GET /api/v1/orders</code> com{" "}
          <code>Authorization: Bearer ish_live_…</code>
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border bg-white p-5">
        <h2 className="font-semibold">Webhooks</h2>
        <Field>
          <FieldLabel>URL de destino</FieldLabel>
          <Input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://seu-servidor.mz/hooks/ishopine"
          />
        </Field>
        <Button disabled={busy || !webhookUrl} onClick={() => void saveWebhook()}>
          Guardar webhook
        </Button>
        <ul className="divide-y rounded-xl border">
          {webhooks.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-taupe">
              Sem endpoints
            </li>
          ) : (
            webhooks.map((w) => (
              <li key={w.id} className="space-y-1 px-4 py-3 text-sm">
                <p className="font-medium break-all">{w.url}</p>
                <p className="text-xs text-taupe">
                  Eventos: {w.events.join(", ") || "todos"} ·{" "}
                  {w.isActive ? "activo" : "inactivo"}
                </p>
                <p className="font-mono text-[10px] text-zinc-400">
                  secret: {w.secret.slice(0, 18)}…
                </p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
