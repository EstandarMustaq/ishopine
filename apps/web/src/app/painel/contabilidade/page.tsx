"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatBRL, formatDate } from "@/lib/format";
import type {
  AccountingAccount,
  AccountingEntry,
  AccountingEntryType,
  Paginated,
} from "@/lib/types";

const entryTypes: AccountingEntryType[] = [
  "REVENUE",
  "EXPENSE",
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "TRANSFER",
];

export default function PainelContabilidadePage() {
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    description: "",
    type: "EXPENSE" as AccountingEntryType,
    amountReais: "",
    debitAccountId: "",
    creditAccountId: "",
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [entriesRes, accountsRes, summaryRes] = await Promise.all([
        api<Paginated<AccountingEntry>>("/accounting/entries?limit=50"),
        api<AccountingAccount[]>("/accounting/accounts"),
        api<Record<string, number>>("/accounting/summary"),
      ]);
      setEntries(entriesRes.items);
      setAccounts(accountsRes);
      setSummary(summaryRes);
      setForm((s) => {
        if (s.debitAccountId || !accountsRes[0]) return s;
        return {
          ...s,
          debitAccountId: accountsRes[0]?.id ?? "",
          creditAccountId: accountsRes[1]?.id ?? accountsRes[0]?.id ?? "",
        };
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao carregar contabilidade",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createEntry(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = Math.round(Number(form.amountReais.replace(",", ".")) * 100);
    if (!amountCents || amountCents <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    try {
      await api("/accounting/entries", {
        method: "POST",
        body: JSON.stringify({
          description: form.description,
          type: form.type,
          amountCents,
          debitAccountId: form.debitAccountId,
          creditAccountId: form.creditAccountId,
          notes: form.notes || undefined,
          postImmediately: false,
        }),
      });
      toast.success("Lançamento criado como rascunho");
      setForm((s) => ({ ...s, description: "", amountReais: "", notes: "" }));
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao criar lançamento",
      );
    }
  }

  async function postEntry(id: string) {
    try {
      await api(`/accounting/entries/${id}/post`, { method: "PATCH" });
      toast.success("Lançamento postado");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao postar",
      );
    }
  }

  async function voidEntry(id: string) {
    try {
      await api(`/accounting/entries/${id}/void`, { method: "PATCH" });
      toast.success("Lançamento anulado");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao anular",
      );
    }
  }

  if (loading && entries.length === 0) {
    return <p className="text-sm text-taupe">Carregando contabilidade...</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal">Contabilidade</h1>
      <p className="mt-1 text-sm text-taupe">
        Lançamentos e resumo financeiro.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(
          [
            ["Receita", summary.revenueCents],
            ["Despesas", summary.expenseCents],
            ["Resultado", summary.netIncomeCents],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="rounded-[12px] border border-border bg-beige p-4"
          >
            <p className="text-xs uppercase tracking-wide text-taupe">{label}</p>
            <p className="mt-1 text-lg font-bold text-[#61005D]">
              {formatBRL(value ?? 0)}
            </p>
          </div>
        ))}
      </div>

      <form
        onSubmit={createEntry}
        className="mt-8 rounded-[12px] border border-border p-5"
      >
        <h2 className="font-semibold">Novo lançamento (rascunho)</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              required
              value={form.description}
              onChange={(e) =>
                setForm((s) => ({ ...s, description: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select
              value={form.type}
              onValueChange={(v) =>
                setForm((s) => ({ ...s, type: v as AccountingEntryType }))
              }
            >
              <SelectTrigger className="rounded-[16px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {entryTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              id="amount"
              required
              inputMode="decimal"
              placeholder="0,00"
              value={form.amountReais}
              onChange={(e) =>
                setForm((s) => ({ ...s, amountReais: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>Conta débito</Label>
            <Select
              value={form.debitAccountId}
              onValueChange={(v) =>
                setForm((s) => ({ ...s, debitAccountId: v }))
              }
            >
              <SelectTrigger className="rounded-[16px]">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Conta crédito</Label>
            <Select
              value={form.creditAccountId}
              onValueChange={(v) =>
                setForm((s) => ({ ...s, creditAccountId: v }))
              }
            >
              <SelectTrigger className="rounded-[16px]">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button type="submit" className="mt-4" size="sm">
          Criar rascunho
        </Button>
      </form>

      <div className="mt-8 overflow-x-auto rounded-[12px] border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-beige text-taupe">
            <tr>
              <th className="px-4 py-3 font-medium">Nº</th>
              <th className="px-4 py-3 font-medium">Descrição</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{entry.entryNumber}</td>
                <td className="px-4 py-3">{entry.description}</td>
                <td className="px-4 py-3">{formatBRL(entry.amountCents)}</td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">{entry.status}</Badge>
                </td>
                <td className="px-4 py-3 text-taupe">
                  {formatDate(entry.entryDate)}
                </td>
                <td className="px-4 py-3">
                  {isAdmin && entry.status === "DRAFT" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mr-2"
                      onClick={() => postEntry(entry.id)}
                    >
                      Postar
                    </Button>
                  )}
                  {isAdmin && entry.status !== "VOID" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => voidEntry(entry.id)}
                    >
                      Anular
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-taupe">
                  Nenhum lançamento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
