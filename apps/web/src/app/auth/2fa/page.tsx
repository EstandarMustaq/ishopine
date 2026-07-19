"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { postLoginPath, useAuthStore } from "@/lib/auth-store";
import type { AuthResponse } from "@/lib/types";

function TwoFactorForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const sessionToken = searchParams.get("sessionToken") ?? "";
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionToken) {
      toast.error("Sessão 2FA inválida. Faça login novamente.");
      router.replace("/entrar");
      return;
    }
    setLoading(true);
    try {
      const data = await api<AuthResponse>("/auth/verify-2fa", {
        method: "POST",
        token: null,
        body: JSON.stringify({ sessionToken, code }),
      });
      setAuth(data.accessToken, data.user);
      toast.success(`Olá, ${data.user.name.split(" ")[0]}!`);
      router.replace(postLoginPath(data.user));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Código inválido",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-3xl font-bold text-[#61005D]">Nkateko</h1>
      <p className="mt-2 text-sm text-taupe">
        Confirme o código do autenticador para continuar
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <Label htmlFor="code">Código 2FA</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            required
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Verificando..." : "Confirmar"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-taupe">
        <Link href="/entrar" className="font-semibold text-[#61005D]">
          Voltar ao login
        </Link>
      </p>
    </div>
  );
}

export default function AuthTwoFactorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-taupe">
          Carregando...
        </div>
      }
    >
      <TwoFactorForm />
    </Suspense>
  );
}
