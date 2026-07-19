import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-200/60 bg-white/50 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-base font-semibold tracking-tight text-zinc-900">
            iShopine
          </p>
          <p className="mt-1 text-[13px] font-medium text-zinc-600">
            Operado por Nkateko Investment and Service
          </p>
          <p className="mt-2 max-w-sm text-[13px] text-zinc-500">
            Mercado aberto de bens — compre e venda com confiança.
          </p>
          <a
            href="https://ishopine.com"
            className="mt-3 inline-block text-[13px] text-zinc-500 transition-colors hover:text-zinc-900"
            target="_blank"
            rel="noopener noreferrer"
          >
            ishopine.com
          </a>
        </div>
        <div className="flex flex-wrap gap-10 text-[13px]">
          <div className="flex flex-col gap-2">
            <p className="font-semibold text-zinc-800">Mercado</p>
            <Link href="/produtos" className="text-zinc-500 hover:text-zinc-900">
              Explorar
            </Link>
            <Link href="/lojas" className="text-zinc-500 hover:text-zinc-900">
              Lojas
            </Link>
            <Link href="/vender" className="text-zinc-500 hover:text-zinc-900">
              Abrir loja
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-semibold text-zinc-800">Conta</p>
            <Link href="/entrar" className="text-zinc-500 hover:text-zinc-900">
              Entrar
            </Link>
            <Link href="/cadastro" className="text-zinc-500 hover:text-zinc-900">
              Criar conta
            </Link>
            <Link href="/conta" className="text-zinc-500 hover:text-zinc-900">
              Meus pedidos
            </Link>
            <Link href="/favoritos" className="text-zinc-500 hover:text-zinc-900">
              Favoritos
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-semibold text-zinc-800">Contato</p>
            <a
              href="mailto:contato@ishopine.com"
              className="text-zinc-500 hover:text-zinc-900"
            >
              contato@ishopine.com
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-zinc-200/60 py-4 text-center text-[12px] text-zinc-400">
        © {new Date().getFullYear()} Nkateko Investment and Service. Todos os
        direitos reservados. iShopine · ishopine.com
      </div>
    </footer>
  );
}
