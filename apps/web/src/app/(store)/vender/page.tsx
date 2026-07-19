"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/auth-store";

export default function VenderPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const canAccessPainel = useAuthStore((s) => s.canAccessPainel);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (accessToken && (canAccessPainel() || user?.canSell)) {
      router.replace("/painel/loja");
    }
  }, [accessToken, canAccessPainel, user, router]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-16 text-center">
      <h1 className="text-3xl font-bold text-[#61005D] sm:text-4xl">
        Abra sua loja
      </h1>
      <p className="mt-4 text-base text-taupe">
        Venda no mercado aberto da Nkateko. Crie sua vitrine, publique produtos
        e receba pedidos de compradores em todo o Brasil.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        {accessToken ? (
          <Button asChild size="lg">
            <Link href="/painel/loja">Ir para minha loja</Link>
          </Button>
        ) : (
          <>
            <Button asChild size="lg">
              <Link href="/cadastro">Criar conta e vender</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/entrar">Já tenho conta</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
