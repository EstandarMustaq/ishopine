import Link from "next/link";
import {
  ArrowUpRight,
  CircleDollarSign,
  CreditCard,
  ExternalLink,
  LogIn,
  Package,
  Store,
  UserPlus,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";

const mercadoLinks = [
  { href: "/produtos", label: "explorar", icon: Package },
  { href: "/lojas", label: "lojas", icon: Store },
  { href: "/vender", label: "abrir loja", icon: CircleDollarSign },
];

const contaLinks = [
  { href: "/entrar", label: "entrar", icon: LogIn },
  { href: "/cadastro", label: "criar conta", icon: UserPlus },
  { href: "/conta", label: "pagamentos", icon: CreditCard },
];

function FooterLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: typeof Package;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2 lowercase text-[var(--brand-taupe)] transition-colors hover:text-[var(--brand-charcoal)]"
    >
      <Icon className="size-3.5 shrink-0 opacity-70" />
      <span>{label}</span>
      <ArrowUpRight className="size-3 shrink-0 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-zinc-600" />
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--brand-border)] bg-[var(--brand-surface)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div>
          <BrandLogo variant="wordmark" showSlogan={false} />
          <p className="mt-3 max-w-sm text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-charcoal)]">
            O marketplace{" "}
            <span className="text-[var(--brand-orange)]">livre</span> de
            Moçambique
          </p>
          <p className="mt-2 max-w-sm text-[13px] text-[var(--brand-taupe)]">
            Compre e venda bens em meticais. Pagamentos via M-pesa, e-Mola e
            cartões.
          </p>
          <a
            href="https://ishopine.com"
            className="group mt-3 inline-flex items-center gap-1.5 text-[13px] text-[var(--brand-taupe)] transition-colors hover:text-[var(--brand-charcoal)]"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="size-3.5 opacity-70" />
            ishopine.com
          </a>
        </div>
        <div className="flex flex-wrap gap-10 text-[13px]">
          <div className="flex flex-col gap-2.5">
            <p className="field-label mb-0">Mercado</p>
            {mercadoLinks.map((link) => (
              <FooterLink key={link.href} {...link} />
            ))}
          </div>
          <div className="flex flex-col gap-2.5">
            <p className="field-label mb-0">Conta</p>
            {contaLinks.map((link) => (
              <FooterLink key={link.href} {...link} />
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-[var(--brand-border)] px-4 py-4 text-center text-[12px] text-[var(--brand-taupe)]">
        © {new Date().getFullYear()} iShopine. Todos os direitos reservados.
      </div>
    </footer>
  );
}
