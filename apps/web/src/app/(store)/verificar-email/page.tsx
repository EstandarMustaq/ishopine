"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { postLoginPath, useAuthStore } from "@/lib/auth-store";
import type { AuthResponse } from "@/lib/types";

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const emailParam = searchParams.get("email") ?? "";
  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    setEmail(emailParam);
    const stored = sessionStorage.getItem("nkateko-dev-code");
    if (stored) setDevCode(stored);
  }, [emailParam]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api<AuthResponse>("/auth/verify-email", {
        method: "POST",
        token: null,
        body: JSON.stringify({ email, code }),
      });
      sessionStorage.removeItem("nkateko-dev-code");
      setAuth(data.accessToken, data.user);
      toast.success("E-mail verificado!");
      router.push(postLoginPath(data.user));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Código inválido",
      );
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (!email) {
      toast.error("Informe o e-mail");
      return;
    }
    setResending(true);
    try {
      const data = await api<{ message: string; devCode?: string }>(
        "/auth/resend-code",
        {
          method: "POST",
          token: null,
          body: JSON.stringify({ email }),
        },
      );
      if (data.devCode) {
        sessionStorage.setItem("nkateko-dev-code", data.devCode);
        setDevCode(data.devCode);
      }
      toast.success(data.message || "Novo código enviado.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao reenviar",
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-3xl font-bold text-[#61005D]">Verificar e-mail</h1>
      <p className="mt-2 text-sm text-taupe">
        Digite o código de 6 dígitos enviado para o seu e-mail.
      </p>

      {devCode && (
        <p className="mt-4 rounded-[12px] border border-border bg-beige px-3 py-2 text-sm text-charcoal">
          Código de desenvolvimento:{" "}
          <span className="font-mono font-semibold tracking-widest">
            {devCode}
          </span>
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="code">Código</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            required
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Verificando..." : "Confirmar"}
        </Button>
      </form>

      <Button
        type="button"
        variant="outline"
        className="mt-3 w-full"
        disabled={resending}
        onClick={() => void onResend()}
      >
        {resending ? "Reenviando..." : "Reenviar código"}
      </Button>

      <p className="mt-6 text-center text-sm text-taupe">
        <Link href="/entrar" className="font-semibold text-[#61005D]">
          Voltar ao login
        </Link>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-taupe">
          Carregando...
        </div>
      }
    >
      <VerifyEmailForm />
    </Suspense>
  );
}
