"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { postLoginPath, useAuthStore } from "@/lib/auth-store";
import type { User } from "@/lib/types";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken =
      searchParams.get("accessToken") ?? searchParams.get("token");

    if (!accessToken) {
      setError("Token ausente no retorno do login.");
      return;
    }

    let cancelled = false;

    async function complete() {
      try {
        const user = await api<User>("/auth/me", { token: accessToken! });
        if (cancelled) return;
        setAuth(accessToken!, user);
        toast.success(`Olá, ${user.name.split(" ")[0]}!`);
        router.replace(postLoginPath(user));
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Falha ao concluir o login",
        );
      }
    }

    void complete();
    return () => {
      cancelled = true;
    };
  }, [searchParams, setAuth, router]);

  if (error) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold text-[#111111]">iShopine</h1>
        <p className="mt-4 text-sm text-taupe">{error}</p>
        <Button asChild className="mt-6">
          <Link href="/entrar">Tentar novamente</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-taupe">
      Concluindo login...
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-taupe">
          Carregando...
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
