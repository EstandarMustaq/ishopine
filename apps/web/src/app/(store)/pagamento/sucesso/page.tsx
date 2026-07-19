import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Pagamento confirmado",
};

export default function PagamentoSucessoPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <div className="glass-panel animate-slide-up w-full px-6 py-10">
        <CheckCircle2 className="mx-auto size-10 text-zinc-900" strokeWidth={1.5} />
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-zinc-900">
          Pagamento confirmado
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
          Obrigado. O seu pagamento no iShopine foi processado com sucesso.
          Pode acompanhar o pedido na sua conta.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/conta">Ver pedidos</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/produtos">Continuar a explorar</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
