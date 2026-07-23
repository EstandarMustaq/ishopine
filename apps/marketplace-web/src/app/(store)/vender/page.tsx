"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { appHandoffUrl, getAppUrls } from "@/lib/app-urls";
import { useAuthStore } from "@/lib/auth-store";

export default function VenderPage() {
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    // Any signed-in user can open a shop — do not wait for canSell.
    if (accessToken) {
      window.location.href = appHandoffUrl("seller", accessToken, "/loja");
    }
  }, [accessToken]);

  const sellerUrl = getAppUrls().seller;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-16 text-center">
      <h1 className="text-3xl font-bold text-[#111111] sm:text-4xl">
        Abra sua loja
      </h1>
      <p className="mt-4 text-base text-taupe">
        Venda no mercado aberto do iShopine. Crie sua vitrine, publique produtos
        e receba pedidos de compradores em todo o Moçambique.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        {accessToken ? (
          <Button asChild size="lg">
            <a href={appHandoffUrl("seller", accessToken, "/loja")}>
              Ir para minha loja
            </a>
          </Button>
        ) : (
          <>
            <Button asChild size="lg">
              <Link href="/cadastro">Criar conta e vender</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href={`/entrar?next=seller`}>Já tenho conta</Link>
            </Button>
            <p className="w-full text-xs text-taupe">
              Painel do vendedor: {sellerUrl}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
