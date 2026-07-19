"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

interface FollowShopButtonProps {
  shopId: string;
  initialFollowing?: boolean;
}

export function FollowShopButton({
  shopId,
  initialFollowing = false,
}: FollowShopButtonProps) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!accessToken) {
      toast.message("Entre para seguir lojas");
      router.push("/entrar");
      return;
    }
    setLoading(true);
    try {
      if (following) {
        await api(`/shops/${shopId}/follow`, { method: "DELETE" });
        setFollowing(false);
        toast.success("Você deixou de seguir esta loja");
      } else {
        await api(`/shops/${shopId}/follow`, { method: "POST" });
        setFollowing(true);
        toast.success("Agora você segue esta loja");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao atualizar follow",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant={following ? "outline" : "default"}
      size="sm"
      disabled={loading}
      onClick={() => void toggle()}
      className={
        following
          ? "border-white/70 bg-white/10 text-white hover:bg-white/20 hover:text-white"
          : "bg-white text-[#111111] hover:bg-white/90"
      }
    >
      {loading ? "..." : following ? "Seguindo" : "Seguir loja"}
    </Button>
  );
}
