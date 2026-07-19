"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, DEV_CODE_STORAGE_KEY, getGoogleAuthUrl } from "@/lib/api";
import { postLoginPath, useAuthStore } from "@/lib/auth-store";
import type { AuthResponse, LoginResult } from "@/lib/types";

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
      <h1 className="text-3xl font-bold text-[#111111]">iShopine</h1>
      <p className="mt-2 text-sm text-taupe">
        Entre para comprar ou vender no mercado aberto
      </p>

      {googleError && (
        <p className="mt-4 rounded-[12px] bg-beige px-3 py-2 text-sm text-charcoal">
          Não foi possível entrar com Google. Tente e-mail e senha.
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {!sessionToken ? (
          <>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </>
        ) : (
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
            <p className="mt-2 text-xs text-taupe">
              Abra o autenticador e digite o código de 6 dígitos.
            </p>
            <button
              type="button"
              className="mt-2 text-xs font-medium text-[#111111] underline"
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
          {loading
            ? "Entrando..."
            : sessionToken
              ? "Confirmar código"
              : "Entrar"}
        </Button>
      </form>

      {!sessionToken && (
        <>
          <div className="my-6 flex items-center gap-3 text-xs text-taupe">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" asChild>
            <a href={getGoogleAuthUrl()}>Continuar com Google</a>
          </Button>
        </>
      )}

      <p className="mt-6 text-center text-sm text-taupe">
        Não tem conta?{" "}
        <Link href="/cadastro" className="font-semibold text-[#111111]">
          Cadastre-se
        </Link>
      </p>

      <p className="mt-4 rounded-[12px] bg-beige px-3 py-2 text-center text-xs text-taupe">
        Demo:{" "}
        <span className="font-medium text-charcoal">admin@ishopine.com</span> /{" "}
        <span className="font-medium text-charcoal">IShopine@2026</span>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-taupe">
          Carregando...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
