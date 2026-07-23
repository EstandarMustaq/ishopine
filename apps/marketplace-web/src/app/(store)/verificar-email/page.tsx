"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { OtpField } from "@/components/forms/otp-field";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, DEV_CODE_STORAGE_KEY } from "@/lib/api";
import {
  navigatePostLogin,
  resolvePostLogin,
  useAuthStore,
} from "@/lib/auth-store";
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
    const stored = sessionStorage.getItem(DEV_CODE_STORAGE_KEY);
    if (stored) setDevCode(stored);
  }, [emailParam]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length < 6) {
      toast.error("Informe o código de 6 dígitos");
      return;
    }
    setLoading(true);
    try {
      const data = await api<AuthResponse>("/auth/verify-email", {
        method: "POST",
        token: null,
        body: JSON.stringify({ email, code }),
      });
      sessionStorage.removeItem(DEV_CODE_STORAGE_KEY);
      setAuth(data.accessToken, data.user);
      toast.success("E-mail verificado!");
      navigatePostLogin(
        resolvePostLogin(
          data.user,
          data.accessToken,
          searchParams.get("next"),
        ),
        (path) => router.push(path),
      );
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
        sessionStorage.setItem(DEV_CODE_STORAGE_KEY, data.devCode);
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
      <p className="text-[18px] font-bold tracking-[-0.02em] text-[var(--ds-text)]">iShopine</p>
      <h1 className="mt-6 text-2xl font-bold text-[var(--brand-charcoal)]">
        Verificar e-mail
      </h1>
      <p className="mt-2 text-sm text-[var(--brand-taupe)]">
        Digite o código de 6 dígitos enviado para o seu e-mail.
      </p>

      {devCode && (
        <p className="mt-4 rounded-xl border border-[var(--brand-border)] bg-[rgba(0,128,96,0.1)] px-3 py-2 text-sm text-[var(--brand-charcoal)]">
          Código de desenvolvimento:{" "}
          <span className="font-mono font-semibold tracking-widest">
            {devCode}
          </span>
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <Field>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
          />
        </Field>
        <OtpField
          id="code"
          label="Código de verificação"
          value={code}
          onChange={setCode}
          maxLength={6}
          autoFocus
        />
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

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-[var(--brand-taupe)]">
          Carregando...
        </div>
      }
    >
      <VerifyEmailForm />
    </Suspense>
  );
}
