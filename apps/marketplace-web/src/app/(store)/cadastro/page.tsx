"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, DEV_CODE_STORAGE_KEY, getGoogleAuthUrl } from "@/lib/api";
import type { RegisterResult } from "@/lib/types";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api<RegisterResult>("/auth/register", {
        method: "POST",
        token: null,
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone || undefined,
        }),
      });

      if (data.devCode) {
        sessionStorage.setItem(DEV_CODE_STORAGE_KEY, data.devCode);
      }

      toast.success(data.message || "Conta criada. Verifique seu e-mail.");
      router.push(
        `/verificar-email?email=${encodeURIComponent(data.email || form.email)}`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha no cadastro",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <BrandLogo variant="wordmark" href={null} className="justify-start" />
      <p className="mt-3 text-sm text-[var(--brand-taupe)]">
        Crie a sua conta para comprar e vender
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <Field>
          <FieldLabel htmlFor="name">Nome completo</FieldLabel>
          <Input
            id="name"
            required
            value={form.name}
            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            placeholder="O seu nome"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
            placeholder="voce@email.com"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="phone">Telefone (opcional)</FieldLabel>
          <Input
            id="phone"
            value={form.phone}
            onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
            placeholder="84xxxxxxx"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Senha</FieldLabel>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={(e) =>
              setForm((s) => ({ ...s, password: e.target.value }))
            }
            placeholder="Mínimo 6 caracteres"
          />
        </Field>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Criando..." : "Criar conta"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-[var(--brand-taupe)]">
        <span className="h-px flex-1 bg-[var(--brand-border)]" />
        ou
        <span className="h-px flex-1 bg-[var(--brand-border)]" />
      </div>

      <Button variant="outline" className="w-full" asChild>
        <a href={getGoogleAuthUrl()}>Continuar com Google</a>
      </Button>

      <p className="mt-6 text-center text-sm text-[var(--brand-taupe)]">
        Já tem conta?{" "}
        <Link
          href="/entrar"
          className="font-semibold text-[var(--brand-orange)]"
        >
          Entrar
        </Link>
      </p>
    </div>
  );
}
