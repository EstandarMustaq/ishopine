"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { TwoFactorSetupResult, User } from "@/lib/types";

function SegurancaContent() {
  const searchParams = useSearchParams();
  const required = searchParams.get("required") === "1";
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setUser = useAuthStore((s) => s.setUser);

  const [setup, setSetup] = useState<TwoFactorSetupResult | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const qrUrl = setup?.qrCodeDataUrl ?? setup?.qrDataUrl;
  const totpEnabled = Boolean(user?.totpEnabled);

  async function startSetup() {
    setLoading(true);
    setBackupCodes(null);
    try {
      const data = await api<TwoFactorSetupResult>("/auth/2fa/setup", {
        method: "POST",
      });
      setSetup(data);
      toast.success("Escaneie o QR no autenticador e confirme o código.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao iniciar 2FA",
      );
    } finally {
      setLoading(false);
    }
  }

  async function enable2fa(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api<{
        enabled: boolean;
        backupCodes: string[];
        accessToken?: string;
        message?: string;
      }>("/auth/2fa/enable", {
        method: "POST",
        body: JSON.stringify({ code }),
      });

      setBackupCodes(data.backupCodes);
      setSetup(null);
      setCode("");

      if (data.accessToken && user) {
        setAuth(data.accessToken, { ...user, totpEnabled: true });
      } else {
        const me = await api<User>("/auth/me");
        setUser(me);
      }

      toast.success(data.message ?? "2FA ativado com sucesso.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Código inválido",
      );
    } finally {
      setLoading(false);
    }
  }

  async function disable2fa(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/auth/2fa/disable", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      const me = await api<User>("/auth/me");
      setUser(me);
      setCode("");
      setSetup(null);
      setBackupCodes(null);
      toast.success("2FA desativado.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao desativar 2FA",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!accessToken || !user) return null;

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-charcoal">Segurança</h1>
      <p className="mt-1 text-sm text-taupe">
        Autenticação em dois fatores para vendedores e equipe da plataforma.
      </p>

      {required && !totpEnabled && (
        <p className="mt-4 rounded-[12px] border border-[#61005D]/30 bg-[var(--brand-purple-light)] px-4 py-3 text-sm text-charcoal">
          Ative o 2FA para acessar o painel de vendas e administração.
        </p>
      )}

      <div className="mt-8 rounded-[12px] border border-border bg-beige p-5">
        <p className="text-sm font-semibold text-charcoal">Status</p>
        <p className="mt-1 text-sm text-taupe">
          {totpEnabled
            ? "2FA ativo na sua conta."
            : "2FA ainda não está ativo."}
        </p>

        {!totpEnabled && !setup && (
          <Button
            className="mt-4"
            disabled={loading}
            onClick={() => void startSetup()}
          >
            {loading ? "Gerando..." : "Configurar autenticador"}
          </Button>
        )}

        {setup && (
          <div className="mt-6 space-y-4">
            {qrUrl && (
              <div className="relative mx-auto size-48 overflow-hidden rounded-[12px] bg-white">
                <Image
                  src={qrUrl}
                  alt="QR Code 2FA"
                  fill
                  unoptimized
                  className="object-contain p-2"
                />
              </div>
            )}
            <p className="break-all text-center text-xs text-taupe">
              Chave manual:{" "}
              <span className="font-mono text-charcoal">{setup.secret}</span>
            </p>
            <form onSubmit={enable2fa} className="space-y-3">
              <div>
                <Label htmlFor="enable-code">Código do autenticador</Label>
                <Input
                  id="enable-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Ativando..." : "Ativar 2FA"}
              </Button>
            </form>
          </div>
        )}

        {backupCodes && (
          <div className="mt-6 rounded-[12px] border border-border bg-white p-4">
            <p className="text-sm font-semibold text-charcoal">
              Códigos de backup
            </p>
            <p className="mt-1 text-xs text-taupe">
              Guarde estes códigos — eles não serão mostrados novamente.
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">
              {backupCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {totpEnabled && (
          <form onSubmit={disable2fa} className="mt-6 space-y-3 border-t border-border pt-6">
            <p className="text-sm text-taupe">
              Para desativar o 2FA, confirme com um código atual.
            </p>
            <div>
              <Label htmlFor="disable-code">Código</Label>
              <Input
                id="disable-code"
                inputMode="numeric"
                required
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              disabled={loading}
              className="w-full"
            >
              {loading ? "Desativando..." : "Desativar 2FA"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function PainelSegurancaPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-taupe">Carregando...</p>}
    >
      <SegurancaContent />
    </Suspense>
  );
}
