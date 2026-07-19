import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--mavula-nav-divider)] bg-beige">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-2xl font-bold text-[#61005D]">Mavula</p>
          <p className="mt-2 max-w-sm text-sm text-taupe">
            Móveis com alma brasileira. Peças selecionadas para transformar sua
            casa.
          </p>
        </div>
        <div className="flex flex-wrap gap-8 text-sm">
          <div className="flex flex-col gap-2">
            <p className="font-semibold text-charcoal">Loja</p>
            <Link href="/produtos" className="text-taupe hover:text-[#61005D]">
              Produtos
            </Link>
            <Link href="/carrinho" className="text-taupe hover:text-[#61005D]">
              Carrinho
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
              href="mailto:contato@mavula.com.br"
              className="text-taupe hover:text-[#61005D]"
            >
              contato@mavula.com.br
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-[var(--mavula-nav-divider)] py-4 text-center text-xs text-taupe">
        © {new Date().getFullYear()} Mavula Móveis. Todos os direitos reservados.
      </div>
    </footer>
  );
}
