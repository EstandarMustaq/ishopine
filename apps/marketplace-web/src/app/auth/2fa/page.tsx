"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand/logo";
import { OtpField } from "@/components/forms/otp-field";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import {
  navigatePostLogin,
  resolvePostLogin,
  useAuthStore,
} from "@/lib/auth-store";
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
    if (code.length < 6) {
      toast.error("Informe o código de 6 dígitos");
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
      navigatePostLogin(
        resolvePostLogin(
          data.user,
          data.accessToken,
          searchParams.get("next"),
        ),
        (path) => router.replace(path),
      );
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
      <BrandLogo variant="wordmark" href={null} className="justify-start" />
      <p className="mt-3 text-sm text-[var(--brand-taupe)]">
        Confirme o código do autenticador para continuar
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <OtpField
          id="code"
          label="Código 2FA"
          description="Abra o Google Authenticator ou Authy."
          value={code}
          onChange={setCode}
          maxLength={6}
          autoFocus
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Verificando..." : "Confirmar"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--brand-taupe)]">
        <Link
          href="/entrar"
          className="font-semibold text-[var(--ds-brand)]"
        >
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
        <div className="flex min-h-screen items-center justify-center text-sm text-[var(--brand-taupe)]">
          Carregando...
        </div>
      }
    >
      <TwoFactorForm />
    </Suspense>
  );
}
