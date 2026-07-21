"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand/logo";
import { OtpField } from "@/components/forms/otp-field";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api, DEV_CODE_STORAGE_KEY, getGoogleAuthUrl } from "@/lib/api";
import { postLoginPath, useAuthStore } from "@/lib/auth-store";
import type { AuthResponse, LoginResult } from "@/lib/types";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.3-.2-1.9H12z"
      />
      <path
        fill="#34A853"
        d="M6.6 14.3l-.9.7-2.5 1.9C4.8 19.6 8.1 21.6 12 21.6c2.4 0 4.4-.8 5.9-2.1l-3.1-2.4c-.8.6-1.9.9-2.8.9-2.2 0-4-1.5-4.7-3.5z"
      />
      <path
        fill="#4A90E2"
        d="M3.2 7.1C2.4 8.7 2 10.3 2 12s.4 3.3 1.2 4.9l3.4-2.6c-.2-.6-.3-1.2-.3-1.8s.1-1.3.3-1.9L3.2 7.1z"
      />
      <path
        fill="#FBBC05"
        d="M12 5.4c1.3 0 2.5.5 3.4 1.3l2.6-2.6C16.4 2.5 14.4 1.6 12 1.6 8.1 1.6 4.8 3.6 3.2 7.1l3.4 2.6C8 6.9 9.8 5.4 12 5.4z"
      />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const googleError = searchParams.get("error") === "google";

  async function finishLogin(data: AuthResponse) {
    setAuth(data.accessToken, data.user);
    toast.success(`Olá, ${data.user.name.split(" ")[0]}!`);
    router.push(postLoginPath(data.user));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (sessionToken) {
        if (code.length < 6) {
          toast.error("Informe o código de 6 dígitos");
          setLoading(false);
          return;
        }
        const data = await api<AuthResponse>("/auth/verify-2fa", {
          method: "POST",
          token: null,
          body: JSON.stringify({ sessionToken, code }),
        });
        await finishLogin(data);
        return;
      }

      const data = await api<LoginResult>("/auth/login", {
        method: "POST",
        token: null,
        body: JSON.stringify({ email, password }),
      });

      if ("requiresEmailVerification" in data && data.requiresEmailVerification) {
        if (data.devCode) {
          sessionStorage.setItem(DEV_CODE_STORAGE_KEY, data.devCode);
        }
        toast.message(data.message ?? "Verifique seu e-mail antes de continuar.");
        router.push(`/verificar-email?email=${encodeURIComponent(data.email)}`);
        return;
      }

      if ("requiresTwoFactor" in data && data.requiresTwoFactor) {
        setSessionToken(data.sessionToken);
        toast.message(data.message ?? "Informe o código do autenticador.");
        return;
      }

      if ("accessToken" in data) {
        await finishLogin(data);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha no login",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <BrandLogo variant="wordmark" href={null} className="justify-start" />
      <p className="mt-3 text-sm text-[var(--brand-taupe)]">
        Entre para comprar ou vender no marketplace livre
      </p>

      {googleError && (
        <p className="mt-4 rounded-xl bg-[var(--brand-orange-soft)] px-3 py-2 text-sm text-[var(--brand-charcoal)]">
          Não foi possível entrar com Google. Tente e-mail e senha.
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        {!sessionToken ? (
          <>
            <Field>
              <FieldLabel htmlFor="email">E-mail</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Senha</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
          </>
        ) : (
          <div className="space-y-3">
            <OtpField
              id="code"
              label="Código 2FA"
              description="Abra o autenticador e digite o código de 6 dígitos."
              value={code}
              onChange={setCode}
              maxLength={6}
              autoFocus
            />
            <button
              type="button"
              className="text-xs font-semibold text-[var(--brand-orange)] underline-offset-2 hover:underline"
              onClick={() => {
                setSessionToken(null);
                setCode("");
              }}
            >
              Voltar ao login
            </button>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Spinner className="size-4" /> : null}
          {loading
            ? "Entrando..."
            : sessionToken
              ? "Confirmar código"
              : "Entrar"}
        </Button>
      </form>

      {!sessionToken && (
        <>
          <div className="my-6 flex items-center gap-3 text-xs text-[var(--brand-taupe)]">
            <span className="h-px flex-1 bg-[var(--brand-border)]" />
            ou
            <span className="h-px flex-1 bg-[var(--brand-border)]" />
          </div>

          <Button variant="outline" className="w-full gap-2" asChild>
            <a href={getGoogleAuthUrl()}>
              <GoogleIcon className="size-4" />
              Continuar com Google
            </a>
          </Button>
        </>
      )}

      <p className="mt-6 text-center text-sm text-[var(--brand-taupe)]">
        Não tem conta?{" "}
        <Link
          href="/cadastro"
          className="font-semibold text-[var(--brand-orange)]"
        >
          Cadastre-se
        </Link>
      </p>

      <p className="mt-4 rounded-xl bg-[var(--brand-surface)] px-3 py-2 text-center text-xs text-[var(--brand-taupe)]">
        Demo:{" "}
        <span className="font-medium text-[var(--brand-charcoal)]">
          admin@ishopine.com
        </span>{" "}
        /{" "}
        <span className="font-medium text-[var(--brand-charcoal)]">
          IShopine@2026
        </span>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-[var(--brand-taupe)]">
          Carregando...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
