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
  { href: "/produtos", label: "explorar", icon: Package },
  { href: "/lojas", label: "lojas", icon: Store },
  { href: "/vender", label: "abrir loja", icon: CircleDollarSign },
];

const contaLinks = [
  { href: "/entrar", label: "entrar", icon: LogIn },
  { href: "/cadastro", label: "criar conta", icon: UserPlus },
  { href: "/painel/billing", label: "pagamentos", icon: CreditCard },
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
      className="group inline-flex items-center gap-2 lowercase text-zinc-500 transition-colors hover:text-zinc-900"
    >
      <Icon className="size-3.5 shrink-0 opacity-70" />
      <span>{label}</span>
      <ArrowUpRight className="size-3 shrink-0 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-zinc-600" />
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-lg font-bold tracking-tight text-zinc-900">
            iShopine
          </p>
          <p className="mt-1 text-[13px] font-medium lowercase text-zinc-600">
            mercado de moçambique, para moçambique
          </p>
          <p className="mt-2 max-w-sm text-[13px] text-zinc-500">
            compre e venda bens em meticais. pagamentos via m-pesa, e-mola e
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
          </a>
        </div>
        <div className="flex flex-wrap gap-10 text-[13px]">
          <div className="flex flex-col gap-2.5">
            <p className="font-semibold lowercase text-zinc-800">mercado</p>
            {mercadoLinks.map((link) => (
              <FooterLink key={link.href} {...link} />
            ))}
          </div>
          <div className="flex flex-col gap-2.5">
            <p className="font-semibold lowercase text-zinc-800">conta</p>
            {contaLinks.map((link) => (
              <FooterLink key={link.href} {...link} />
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-zinc-100 px-4 py-4 text-center text-[12px] lowercase text-zinc-400">
        © {new Date().getFullYear()} ishopine. todos os direitos reservados.
      </div>
    </footer>
  );
}
