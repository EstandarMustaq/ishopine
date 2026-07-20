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

const mercadoLinks = [
  { href: "/produtos", label: "Explorar", icon: Package },
  { href: "/lojas", label: "Lojas", icon: Store },
  { href: "/vender", label: "Abrir loja", icon: CircleDollarSign },
];

const contaLinks = [
  { href: "/entrar", label: "Entrar", icon: LogIn },
  { href: "/cadastro", label: "Criar conta", icon: UserPlus },
  { href: "/painel/billing", label: "Pagamentos", icon: CreditCard },
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
      className="group inline-flex items-center gap-2 text-zinc-500 transition-colors hover:text-zinc-900"
    >
      <Icon className="size-3.5 shrink-0 opacity-70" />
      <span>{label}</span>
      <ArrowUpRight className="size-3 shrink-0 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-zinc-600" />
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-200/60 bg-white/50 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-base font-semibold tracking-tight text-zinc-900">
            iShopine
          </p>
          <p className="mt-1 text-[13px] font-medium text-zinc-600">
            Mercado de Moçambique, para Moçambique
          </p>
          <p className="mt-2 max-w-sm text-[13px] text-zinc-500">
            Compre e venda bens em meticais. Pagamentos via M-pesa, e-Mola e
            cartões.
          </p>
          <a
            href="https://ishopine.com"
            className="group mt-3 inline-flex items-center gap-1.5 text-[13px] text-zinc-500 transition-colors hover:text-zinc-900"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="size-3.5 opacity-70" />
            ishopine.com
            <ArrowUpRight className="size-3 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-zinc-600" />
          </a>
        </div>
        <div className="flex flex-wrap gap-10 text-[13px]">
          <div className="flex flex-col gap-2.5">
            <p className="font-semibold text-zinc-800">Mercado</p>
            {mercadoLinks.map((link) => (
              <FooterLink key={link.href} {...link} />
            ))}
          </div>
          <div className="flex flex-col gap-2.5">
            <p className="font-semibold text-zinc-800">Conta</p>
            {contaLinks.map((link) => (
              <FooterLink key={link.href} {...link} />
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-zinc-200/60 px-4 py-4 text-center text-[12px] text-zinc-400">
        © {new Date().getFullYear()} iShopine. Todos os direitos reservados.
      </div>
    </footer>
  );
}
