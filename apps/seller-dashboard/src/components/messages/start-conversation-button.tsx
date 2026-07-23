"use client";

import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { Conversation } from "@/lib/types";

interface StartConversationButtonProps {
  shopId: string;
  productId?: string;
  subject?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
  label?: string;
}

export function StartConversationButton({
  shopId,
  productId,
  subject,
  variant = "outline",
  size = "sm",
  className,
  label = "Mensagem",
}: StartConversationButtonProps) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [loading, setLoading] = useState(false);

  async function start() {
    if (!accessToken) {
      toast.message("Entre para enviar mensagens");
      router.push("/entrar");
      return;
    }
    setLoading(true);
    try {
      const conversation = await api<Conversation>("/conversations", {
        method: "POST",
        body: JSON.stringify({
          shopId,
          productId: productId || undefined,
          subject: subject || undefined,
        }),
      });
      router.push(`/mensagens/${conversation.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao iniciar conversa",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={loading}
      onClick={() => void start()}
      className={className}
    >
      <MessageCircle className="mr-1 size-4" />
      {loading ? "Abrindo..." : label}
    </Button>
  );
}
