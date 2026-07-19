"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Conversation, Message } from "@/lib/types";

export default function MensagemDetailPage() {
  const params = useParams<{ id: string }>();
  const conversationId = params.id;
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!accessToken || !conversationId) {
      setLoading(false);
      return;
    }
    try {
      const [convs, msgs] = await Promise.all([
        api<Conversation[] | { items: Conversation[] }>("/conversations"),
        api<Message[] | { items: Message[] }>(
          `/conversations/${conversationId}/messages`,
        ),
      ]);
      const list = Array.isArray(convs) ? convs : (convs.items ?? []);
      setConversation(list.find((c) => c.id === conversationId) ?? null);
      setMessages(Array.isArray(msgs) ? msgs : (msgs.items ?? []));
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, conversationId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      const created = await api<Message>(
        `/conversations/${conversationId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ body: body.trim() }),
        },
      );
      setMessages((prev) => [...prev, created]);
      setBody("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao enviar mensagem",
      );
    } finally {
      setSending(false);
    }
  }

  if (!accessToken) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Mensagens</h1>
        <p className="mt-3 text-sm text-taupe">Entre para continuar.</p>
        <Button asChild className="mt-6">
          <Link href="/entrar">Entrar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-4 py-10 sm:px-6">
      <nav className="mb-4 text-sm text-taupe">
        <Link href="/mensagens" className="hover:text-[#61005D]">
          Mensagens
        </Link>
        <span className="mx-2">/</span>
        <span className="text-charcoal">
          {conversation?.shop?.name ?? "Conversa"}
        </span>
      </nav>

      <h1 className="text-2xl font-bold text-charcoal">
        {conversation?.subject || conversation?.shop?.name || "Conversa"}
      </h1>
      {conversation?.shop && (
        <p className="mt-1 text-sm text-taupe">
          Loja{" "}
          <Link
            href={`/lojas/${conversation.shop.slug}`}
            className="font-medium text-[#61005D] hover:underline"
          >
            {conversation.shop.name}
          </Link>
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-taupe">Carregando...</p>
      ) : (
        <>
          <div className="mt-6 flex max-h-[55vh] flex-col gap-3 overflow-y-auto rounded-[12px] border border-border p-4">
            {messages.length === 0 && (
              <p className="py-8 text-center text-sm text-taupe">
                Nenhuma mensagem ainda. Digite abaixo para começar.
              </p>
            )}
            {messages.map((msg) => {
              const mine = msg.senderId === user?.id;
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-[85%] rounded-[12px] px-3 py-2 text-sm",
                    mine
                      ? "ml-auto bg-[#61005D] text-white"
                      : "bg-beige text-charcoal",
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.body}</p>
                  <p
                    className={cn(
                      "mt-1 text-[10px]",
                      mine ? "text-white/70" : "text-taupe",
                    )}
                  >
                    {formatDateTime(msg.createdAt)}
                  </p>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={send} className="mt-4 space-y-3">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escreva sua mensagem..."
              rows={3}
              required
            />
            <Button type="submit" disabled={sending || !body.trim()}>
              {sending ? "Enviando..." : "Enviar"}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
