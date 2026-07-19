"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import type { WishlistItem } from "@/lib/types";

interface WishlistButtonProps {
  productId: string;
  className?: string;
  size?: "icon-sm" | "sm" | "default";
}

export function WishlistButton({
  productId,
  className,
  size = "icon-sm",
}: WishlistButtonProps) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) {
      setActive(false);
      return;
    }
    try {
      const data = await api<WishlistItem[] | { items: WishlistItem[] }>(
        "/wishlist",
      );
      const items = Array.isArray(data) ? data : (data.items ?? []);
      setActive(items.some((item) => item.productId === productId));
    } catch {
      setActive(false);
    }
  }, [accessToken, productId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!accessToken) {
      toast.message("Entre para salvar favoritos");
      router.push("/entrar");
      return;
    }
    setLoading(true);
    try {
      if (active) {
        await api(`/wishlist/${productId}`, { method: "DELETE" });
        setActive(false);
        toast.success("Removido dos favoritos");
      } else {
        await api("/wishlist", {
          method: "POST",
          body: JSON.stringify({ productId }),
        });
        setActive(true);
        toast.success("Adicionado aos favoritos");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao atualizar favoritos",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      disabled={loading}
      onClick={toggle}
      aria-label={active ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      className={cn(
        "bg-white/90 text-charcoal hover:bg-white hover:text-[#61005D]",
        active && "text-[#61005D]",
        className,
      )}
    >
      <Heart className={cn("size-4", active && "fill-current")} />
    </Button>
  );
}
