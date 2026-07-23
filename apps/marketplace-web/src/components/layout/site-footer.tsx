import Link from "next/link";

const mercadoLinks = [
  { href: "/produtos", label: "Mercado" },
  { href: "/lojas", label: "Lojas" },
  { href: "/vender", label: "Abrir loja" },
];

const contaLinks = [
  { href: "/entrar", label: "Entrar" },
  { href: "/cadastro", label: "Criar conta" },
  { href: "/conta", label: "Minha conta" },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--ds-border-subdued)] bg-[var(--ds-surface)]">
      <div className="mx-auto flex max-w-[var(--ds-max-width)] flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:justify-between">
        <div>
          <p className="text-[18px] font-bold tracking-[-0.02em] text-[var(--ds-text)]">
            iShopine
          </p>
          <p className="mt-2 max-w-sm text-[14px] leading-[1.6] text-[var(--ds-text-secondary)]">
            Marketplace de Moçambique. Compre e venda em MZN com M-Pesa, e-Mola
            e cartão.
          </p>
        </div>
        <div className="flex flex-wrap gap-10 text-[14px]">
          <div className="flex flex-col gap-2">
            <p className="text-[12px] font-medium uppercase tracking-[0.01em] text-[var(--ds-text-secondary)]">
              Mercado
            </p>
            {mercadoLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[var(--ds-text)] hover:text-[var(--ds-brand)]"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-[12px] font-medium uppercase tracking-[0.01em] text-[var(--ds-text-secondary)]">
              Conta
            </p>
            {contaLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[var(--ds-text)] hover:text-[var(--ds-brand)]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-[var(--ds-border-subdued)] px-4 py-4 text-center text-[12px] text-[var(--ds-text-secondary)]">
        © {new Date().getFullYear()} iShopine
      </div>
    </footer>
  );
}
