"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatDateTime } from "@/lib/format";
import type { Conversation } from "@/lib/types";

export default function MensagensPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    try {
      const data = await api<Conversation[] | { items: Conversation[] }>(
        "/conversations",
      );
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

  if (!accessToken) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Mensagens</h1>
        <p className="mt-3 text-sm text-taupe">
          Entre para falar com vendedores.
        </p>
        <Button asChild className="mt-6">
          <Link href="/entrar">Entrar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-charcoal">Mensagens</h1>
      <p className="mt-2 text-sm text-taupe">
        Conversas entre compradores e vendedores.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-taupe">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-[12px] bg-beige px-6 py-12 text-center">
          <p className="text-sm text-taupe">
            Nenhuma conversa ainda. Abra o chat a partir de um produto ou loja.
          </p>
          <Button asChild className="mt-4">
            <Link href="/produtos">Explorar mercado</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/mensagens/${c.id}`}
                className="block rounded-[12px] border border-border p-4 transition-colors hover:border-[#61005D]/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-charcoal">
                      {c.shop?.name ?? "Conversa"}
                    </p>
                    {c.subject && (
                      <p className="mt-0.5 text-sm text-taupe">{c.subject}</p>
                    )}
                    {c.lastMessage?.body && (
                      <p className="mt-2 line-clamp-1 text-sm text-charcoal">
                        {c.lastMessage.body}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    {(c.lastMessageAt || c.createdAt) && (
                      <p className="text-xs text-taupe">
                        {formatDateTime(c.lastMessageAt || c.createdAt!)}
                      </p>
                    )}
                    {(c.unreadCount ?? 0) > 0 && (
                      <span className="mt-1 inline-flex rounded-full bg-[#61005D] px-2 py-0.5 text-[10px] font-semibold text-white">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
