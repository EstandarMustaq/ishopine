"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatDateTime } from "@/lib/format";
import type { Dispute, DisputeStatus, Order } from "@/lib/types";

const statusLabel: Record<DisputeStatus, string> = {
  OPEN: "Aberta",
  IN_REVIEW: "Em análise",
  RESOLVED: "Resolvida",
  REJECTED: "Rejeitada",
  CLOSED: "Fechada",
};

function ContaDisputasContent() {
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get("orderId") ?? "";
  const accessToken = useAuthStore((s) => s.accessToken);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    orderId: orderIdParam,
    reason: "",
    description: "",
  });

  useEffect(() => {
    if (orderIdParam) {
      setForm((s) => ({ ...s, orderId: orderIdParam }));
    }
  }, [orderIdParam]);

  const load = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    try {
      const [d, o] = await Promise.all([
        api<Dispute[] | { items: Dispute[] }>("/disputes").catch(() => []),
        api<Order[]>("/orders/mine").catch(() => []),
      ]);
      setDisputes(Array.isArray(d) ? d : (d.items ?? []));
      setOrders(o);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.orderId || !form.reason || !form.description) {
      toast.error("Preencha pedido, motivo e descrição");
      return;
    }
    setSubmitting(true);
    try {
      await api("/disputes", {
        method: "POST",
        body: JSON.stringify(form),
      });
      toast.success("Disputa aberta");
      setForm({ orderId: "", reason: "", description: "" });
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao abrir disputa",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!accessToken) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Disputas</h1>
        <p className="mt-3 text-sm text-taupe">Entre para gerenciar disputas.</p>
        <Button asChild className="mt-6">
          <Link href="/entrar">Entrar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <nav className="mb-4 text-sm text-taupe">
        <Link href="/conta" className="hover:text-[#111111]">
          Conta
        </Link>
        <span className="mx-2">/</span>
        <span className="text-charcoal">Disputas</span>
      </nav>

      <h1 className="text-3xl font-bold text-charcoal">Disputas</h1>
      <p className="mt-2 text-sm text-taupe">
        Abra uma disputa sobre um pedido e acompanhe o status.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-8 space-y-4 rounded-[12px] border border-border p-5"
      >
        <h2 className="font-semibold">Nova disputa</h2>
        <div>
          <Label>Pedido</Label>
          <Select
            value={form.orderId}
            onValueChange={(v) => setForm((s) => ({ ...s, orderId: v }))}
          >
            <SelectTrigger className="mt-1 h-11 rounded-[16px]">
              <SelectValue placeholder="Selecione um pedido" />
            </SelectTrigger>
            <SelectContent>
              {orders.map((order) => (
                <SelectItem key={order.id} value={order.id}>
                  {order.orderNumber}
                  {order.sellerShop?.name ? ` · ${order.sellerShop.name}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="reason">Motivo</Label>
          <Input
            id="reason"
            required
            value={form.reason}
            onChange={(e) =>
              setForm((s) => ({ ...s, reason: e.target.value }))
            }
            placeholder="Ex.: Produto não chegou"
          />
        </div>
        <div>
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            required
            rows={4}
            value={form.description}
            onChange={(e) =>
              setForm((s) => ({ ...s, description: e.target.value }))
            }
          />
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Enviando..." : "Abrir disputa"}
        </Button>
      </form>

      <h2 className="mt-10 text-xl font-semibold">Minhas disputas</h2>
      {loading ? (
        <p className="mt-4 text-sm text-taupe">Carregando...</p>
      ) : disputes.length === 0 ? (
        <p className="mt-4 text-sm text-taupe">Nenhuma disputa aberta.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {disputes.map((d) => (
            <li
              key={d.id}
              className="rounded-[12px] border border-border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-charcoal">{d.reason}</p>
                  <p className="mt-1 text-xs text-taupe">
                    Pedido {d.order?.orderNumber ?? d.orderId} ·{" "}
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

export default function ContaDisputasPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-sm text-taupe">Carregando...</div>
      }
    >
      <ContaDisputasContent />
    </Suspense>
  );
}
