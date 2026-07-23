"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

interface AddToCartButtonProps {
  productId: string;
  disabled?: boolean;
}

export function AddToCartButton({ productId, disabled }: AddToCartButtonProps) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    if (!accessToken) {
      toast.message("Faça login para adicionar ao carrinho");
      router.push("/entrar");
      return;
    }

    setLoading(true);
    try {
      await api("/cart/items", {
        method: "POST",
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      toast.success("Produto adicionado ao carrinho");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível adicionar",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      size="lg"
      className="w-full sm:w-auto"
      disabled={disabled || loading}
      onClick={handleAdd}
    >
      {loading ? "Adicionando..." : "Adicionar ao carrinho"}
    </Button>
  );
}
