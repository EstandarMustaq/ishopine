"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <h1 className="text-3xl font-bold text-[#61005D]">iShoppine</h1>
      <p className="mt-2 text-sm text-taupe">
        Crie sua conta para comprar e vender
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            required
            value={form.name}
            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="phone">Telefone (opcional)</Label>
          <Input
            id="phone"
            value={form.phone}
            onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={(e) =>
              setForm((s) => ({ ...s, password: e.target.value }))
            }
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Criando..." : "Criar conta"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-taupe">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button variant="outline" className="w-full" asChild>
        <a href={getGoogleAuthUrl()}>Continuar com Google</a>
      </Button>

      <p className="mt-6 text-center text-sm text-taupe">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-semibold text-[#61005D]">
          Entrar
        </Link>
      </p>
    </div>
  );
}
