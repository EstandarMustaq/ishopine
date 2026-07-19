"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/lib/types";

export default function NotificacoesPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    try {
      const data = await api<
        NotificationItem[] | { items: NotificationItem[] }
      >("/notifications");
      setItems(Array.isArray(data) ? data : (data.items ?? []));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    try {
      await api(`/notifications/${id}/read`, { method: "PATCH" });
      setItems((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, isRead: true, readAt: new Date().toISOString() }
            : n,
        ),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao marcar como lida",
      );
    }
  }

  async function markAllRead() {
    try {
      await api("/notifications/read-all", { method: "PATCH" });
      setItems((prev) =>
        prev.map((n) => ({
          ...n,
          isRead: true,
          readAt: n.readAt ?? new Date().toISOString(),
        })),
      );
      toast.success("Todas marcadas como lidas");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao marcar todas",
      );
    }
  }

  if (!accessToken) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Notificações</h1>
        <p className="mt-3 text-sm text-taupe">
          Entre para ver suas notificações.
        </p>
        <Button asChild className="mt-6">
          <Link href="/entrar">Entrar</Link>
        </Button>
      </div>
    );
  }

  const unread = items.filter((n) => !n.isRead && !n.readAt).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-charcoal">Notificações</h1>
          <p className="mt-2 text-sm text-taupe">
            {unread > 0
              ? `${unread} não lida${unread > 1 ? "s" : ""}`
              : "Tudo em dia"}
          </p>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={() => void markAllRead()}>
            Marcar todas como lidas
          </Button>
        )}
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-taupe">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-[12px] bg-beige px-6 py-12 text-center">
          <p className="text-sm text-taupe">Nenhuma notificação por enquanto.</p>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((item) => {
            const isUnread = !item.isRead && !item.readAt;
            return (
              <li
                key={item.id}
                className={cn(
                  "rounded-[12px] border border-border p-4",
                  isUnread && "border-[#61005D]/20 bg-[var(--brand-purple-light)]/40",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-charcoal">{item.title}</p>
                    {item.body && (
                      <p className="mt-1 text-sm text-taupe">{item.body}</p>
                    )}
                    <p className="mt-2 text-xs text-taupe">
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {item.linkUrl && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={item.linkUrl}>Abrir</Link>
                      </Button>
                    )}
                    {isUnread && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void markRead(item.id)}
                      >
                        Marcar lida
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
