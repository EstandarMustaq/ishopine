import Link from "next/link";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Pagamento cancelado",
};

export default function PagamentoCanceladoPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <div className="glass-panel animate-slide-up w-full px-6 py-10">
        <XCircle className="mx-auto size-10 text-zinc-500" strokeWidth={1.5} />
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-zinc-900">
          Pagamento cancelado
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
          O checkout PaySuite foi cancelado. O pedido pode ficar pendente — pode
          tentar novamente no carrinho ou na sua conta.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/checkout">Tentar novamente</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/carrinho">Voltar ao carrinho</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
