import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--brand-nav-divider)] bg-beige">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-2xl font-bold text-[#61005D]">Nkateko</p>
          <p className="mt-1 text-sm font-medium text-charcoal">
            Nkateko Investment and Service
          </p>
          <p className="mt-2 max-w-sm text-sm text-taupe">
            Mercado aberto de bens — compre e venda com confiança.
          </p>
        </div>
        <div className="flex flex-wrap gap-8 text-sm">
          <div className="flex flex-col gap-2">
            <p className="font-semibold text-charcoal">Mercado</p>
            <Link href="/produtos" className="text-taupe hover:text-[#61005D]">
              Explorar
            </Link>
            <Link href="/lojas" className="text-taupe hover:text-[#61005D]">
              Lojas
            </Link>
            <Link href="/vender" className="text-taupe hover:text-[#61005D]">
              Abrir loja
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-semibold text-charcoal">Conta</p>
            <Link href="/entrar" className="text-taupe hover:text-[#61005D]">
              Entrar
            </Link>
            <Link href="/cadastro" className="text-taupe hover:text-[#61005D]">
              Criar conta
            </Link>
            <Link href="/conta" className="text-taupe hover:text-[#61005D]">
              Meus pedidos
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-semibold text-charcoal">Contato</p>
            <a
              href="mailto:contato@nkateko.com"
              className="text-taupe hover:text-[#61005D]"
            >
              contato@nkateko.com
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-[var(--brand-nav-divider)] py-4 text-center text-xs text-taupe">
        © {new Date().getFullYear()} Nkateko Investment and Service. Todos os
        direitos reservados.
      </div>
    </footer>
  );
}
