"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, Smartphone, Wallet } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatMZN } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  Address,
  Cart,
  CheckoutResult,
  CouponValidation,
  PaysuiteCheckoutResponse,
  PaysuiteMethod,
  PaysuiteStatusResponse,
} from "@/lib/types";

function normalizeMsisdn(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("258")) return digits;
  if (digits.startsWith("8") && digits.length === 9) return `258${digits}`;
  return digits;
}

const METHODS: {
  id: PaysuiteMethod;
  title: string;
  subtitle: string;
  icon: typeof CreditCard;
}[] = [
  {
    id: "mpesa",
    title: "M-Pesa",
    subtitle: "Vodacom Moçambique",
    icon: Smartphone,
  },
  {
    id: "emola",
    title: "e-Mola",
    subtitle: "Carteira móvel",
    icon: Wallet,
  },
  {
    id: "credit_card",
    title: "Cartão",
    subtitle: "Visa / Mastercard",
    icon: CreditCard,
  },
];

export default function CheckoutPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [cart, setCart] = useState<Cart | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string>("");
  const [payMethod, setPayMethod] = useState<PaysuiteMethod>("mpesa");
  const [msisdn, setMsisdn] = useState("");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<CouponValidation | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [newAddress, setNewAddress] = useState({
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
    zipCode: "",
  });

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const load = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    try {
      const [cartData, addressData] = await Promise.all([
        api<Cart>("/cart"),
        api<Address[]>("/addresses"),
      ]);
      setCart(cartData);
      setAddresses(addressData);
      const defaultAddr =
        addressData.find((a) => a.isDefault) ?? addressData[0];
      if (defaultAddr) setAddressId(defaultAddr.id);
      if (addressData.length === 0) setShowNewAddress(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar checkout",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createAddress() {
    try {
      const created = await api<Address>("/addresses", {
        method: "POST",
        body: JSON.stringify({ ...newAddress, isDefault: true }),
      });
      setAddresses((prev) => [...prev, created]);
      setAddressId(created.id);
      setShowNewAddress(false);
      toast.success("Endereço guardado");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao guardar endereço",
      );
    }
  }

  async function validateCoupon() {
    if (!cart || !couponCode.trim()) {
      toast.error("Informe um código de cupom");
      return;
    }
    setValidatingCoupon(true);
    try {
      const result = await api<CouponValidation>("/coupons/validate", {
        method: "POST",
        body: JSON.stringify({
          code: couponCode.trim(),
          subtotalCents: cart.subtotalCents,
        }),
      });
      if (!result.valid) {
        setCoupon(null);
        toast.error(result.message || "Cupom inválido");
        return;
      }
      setCoupon(result);
      toast.success(
        result.message ||
          `Cupom aplicado: −${formatMZN(result.discountCents)}`,
      );
    } catch (error) {
      setCoupon(null);
      toast.error(
        error instanceof Error ? error.message : "Erro ao validar cupom",
      );
    } finally {
      setValidatingCoupon(false);
    }
  }

  function startStatusPolling(id: string) {
    stopPolling();
    let attempts = 0;
    pollRef.current = setInterval(() => {
      attempts += 1;
      void (async () => {
        try {
          const status = await api<PaysuiteStatusResponse>(
            `/billing/paysuite/status/${id}`,
          );
          setPaymentStatus(status.status);
          const done =
            status.status === "PAID" ||
            status.status === "FAILED" ||
            status.status === "CANCELLED";
          if (done) {
            stopPolling();
            if (status.status === "PAID") {
              toast.success("Pagamento confirmado!");
              router.push("/pagamento/sucesso");
            } else {
              toast.error(status.message || "Pagamento não concluído");
            }
          }
        } catch {
          // keep polling
        }
        if (attempts >= 40) {
          stopPolling();
          toast.message(
            "Aguardando confirmação PaySuite. Veja em Pagamentos.",
          );
        }
      })();
    }, 3000);
  }

  async function handleCheckout() {
    if (!addressId) {
      toast.error("Seleccione ou cadastre um endereço");
      return;
    }
    if (payMethod === "mpesa" || payMethod === "emola") {
      const phone = normalizeMsisdn(msisdn);
      if (msisdn && phone.length < 9) {
        toast.error("Informe um número moçambicano válido");
        return;
      }
    }

    setSubmitting(true);
    try {
      const orderPaymentMethod =
        payMethod === "mpesa"
          ? "MPESA"
          : payMethod === "emola"
            ? "EMOLA"
            : "CREDIT_CARD";

      const checkout = await api<CheckoutResult>("/orders/checkout", {
        method: "POST",
        body: JSON.stringify({
          addressId,
          paymentMethod: orderPaymentMethod,
          couponCode: coupon?.valid ? coupon.code : undefined,
        }),
      });

      const orderIds = checkout.orders.map((o) => o.id);
      const orderLabel =
        checkout.orders.length === 1
          ? checkout.orders[0].orderNumber
          : `${checkout.orderCount} pedidos`;

      const session = await api<PaysuiteCheckoutResponse>(
        "/billing/paysuite/checkout",
        {
          method: "POST",
          body: JSON.stringify({
            orderIds,
            method: payMethod,
            msisdn:
              payMethod === "mpesa" || payMethod === "emola"
                ? normalizeMsisdn(msisdn) || undefined
                : undefined,
          }),
        },
      );

      const url = session.checkoutUrl ?? session.url;
      if (url && !session.simulated) {
        toast.success(`${orderLabel} criado — a redireccionar ao PaySuite…`);
        window.location.href = url;
        return;
      }

      if (session.simulated && url) {
        toast.success(session.message || "Pagamento simulado");
        window.location.href = url;
        return;
      }

      setPaymentId(session.paymentId);
      setPaymentStatus(session.status ?? "PROCESSING");
      toast.success(session.message || `${orderLabel} — confirme o pagamento`);
      if (String(session.status).toUpperCase() === "PAID") {
        router.push("/pagamento/sucesso");
        return;
      }
      startStatusPolling(session.paymentId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao finalizar pedido",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!accessToken) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
        <p className="mt-3 text-[13px] text-zinc-500">
          Entre na sua conta para finalizar a compra.
        </p>
        <Button asChild className="mt-6">
          <Link href="/entrar">Entrar</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-[13px] text-zinc-500">
        A carregar...
      </div>
    );
  }

  if (!cart?.items?.length) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Carrinho vazio</h1>
        <Button asChild className="mt-6">
          <Link href="/produtos">Explorar mercado</Link>
        </Button>
      </div>
    );
  }

  const discountCents = coupon?.valid ? coupon.discountCents : 0;
  const totalCents = Math.max(0, cart.subtotalCents - discountCents);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
        Checkout
      </h1>
      <p className="mt-1 text-[13px] text-zinc-500">
        Pagamentos em meticais (MZN) via PaySuite — M-Pesa, e-Mola e cartões.
      </p>

      <div className="mt-8 space-y-4">
        <section className="glass-panel animate-slide-up p-5">
          <h2 className="text-[14px] font-semibold text-zinc-900">Entrega</h2>
          {addresses.length > 0 && !showNewAddress && (
            <div className="mt-3">
              <Label>Endereço</Label>
              <Select value={addressId} onValueChange={setAddressId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Seleccione" />
                </SelectTrigger>
                <SelectContent>
                  {addresses.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.street} {a.number}, {a.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                className="mt-2 text-[12px] font-medium text-zinc-600 underline"
                onClick={() => setShowNewAddress(true)}
              >
                Novo endereço
              </button>
            </div>
          )}
          {(showNewAddress || addresses.length === 0) && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="street">Avenida / Rua</Label>
                <Input
                  id="street"
                  value={newAddress.street}
                  onChange={(e) =>
                    setNewAddress((s) => ({ ...s, street: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="number">Nº</Label>
                <Input
                  id="number"
                  value={newAddress.number}
                  onChange={(e) =>
                    setNewAddress((s) => ({ ...s, number: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="district">Bairro</Label>
                <Input
                  id="district"
                  value={newAddress.district}
                  onChange={(e) =>
                    setNewAddress((s) => ({ ...s, district: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={newAddress.city}
                  onChange={(e) =>
                    setNewAddress((s) => ({ ...s, city: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="state">Província</Label>
                <Input
                  id="state"
                  value={newAddress.state}
                  onChange={(e) =>
                    setNewAddress((s) => ({ ...s, state: e.target.value }))
                  }
                  placeholder="ex: Maputo"
                />
              </div>
              <div>
                <Label htmlFor="zipCode">Código postal</Label>
                <Input
                  id="zipCode"
                  value={newAddress.zipCode}
                  onChange={(e) =>
                    setNewAddress((s) => ({ ...s, zipCode: e.target.value }))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={createAddress}>
                  Guardar endereço
                </Button>
              </div>
            </div>
          )}
        </section>

        <section className="glass-panel animate-slide-up p-5">
          <h2 className="text-[14px] font-semibold text-zinc-900">Pagamento</h2>
          <p className="mt-1 text-[12px] text-zinc-500">
            Processado por{" "}
            <a
              href="https://paysuite.co.mz"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              PaySuite
            </a>{" "}
            (Moçambique). Transacções reais em produção.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {METHODS.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPayMethod(m.id)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-all duration-200",
                    payMethod === m.id
                      ? "border-zinc-900 bg-white shadow-soft"
                      : "border-zinc-200/80 bg-white/40 hover:border-zinc-300",
                  )}
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-zinc-700" />
                  <span>
                    <span className="block text-[13px] font-semibold text-zinc-900">
                      {m.title}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-zinc-500">
                      {m.subtitle}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {(payMethod === "mpesa" || payMethod === "emola") && (
            <div className="mt-4 animate-fade-in">
              <Label htmlFor="msisdn">Telemóvel (opcional)</Label>
              <Input
                id="msisdn"
                inputMode="tel"
                placeholder="84xxxxxxx ou 25884xxxxxxx"
                value={msisdn}
                onChange={(e) => setMsisdn(e.target.value)}
                className="mt-1.5"
              />
              <p className="mt-1.5 text-[12px] text-zinc-500">
                Será redireccionado ao checkout PaySuite para confirmar.
              </p>
            </div>
          )}

          {paymentId && (
            <p className="mt-3 rounded-xl border border-zinc-200/60 bg-white/60 px-3 py-2 text-[12px] text-zinc-600">
              Pagamento{" "}
              <span className="font-mono text-zinc-900">{paymentId}</span>
              {paymentStatus ? ` · ${paymentStatus}` : ""}
            </p>
          )}
        </section>

        <section className="glass-panel p-5">
          <h2 className="text-[14px] font-semibold text-zinc-900">Cupom</h2>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              value={couponCode}
              onChange={(e) => {
                setCouponCode(e.target.value.toUpperCase());
                setCoupon(null);
              }}
              placeholder="Código do cupom"
              className="sm:flex-1"
            />
            <Button
              type="button"
              variant="outline"
              disabled={validatingCoupon}
              onClick={() => void validateCoupon()}
            >
              {validatingCoupon ? "A validar..." : "Aplicar"}
            </Button>
          </div>
          {coupon?.valid && (
            <p className="mt-2 text-[13px] font-medium text-zinc-900">
              Cupom {coupon.code} aplicado (−{formatMZN(coupon.discountCents)})
            </p>
          )}
        </section>

        <section className="glass-panel p-5">
          <div className="flex justify-between text-[13px]">
            <span className="text-zinc-500">Subtotal</span>
            <span className="font-semibold text-zinc-900">
              {formatMZN(cart.subtotalCents)}
            </span>
          </div>
          {discountCents > 0 && (
            <div className="mt-2 flex justify-between text-[13px]">
              <span className="text-zinc-500">Desconto</span>
              <span className="font-semibold text-zinc-900">
                −{formatMZN(discountCents)}
              </span>
            </div>
          )}
          <div className="mt-2 flex justify-between text-[13px]">
            <span className="text-zinc-500">Total</span>
            <span className="font-semibold text-zinc-900">
              {formatMZN(totalCents)}
            </span>
          </div>
          <Button
            className="mt-5 w-full"
            disabled={submitting || Boolean(paymentId)}
            onClick={() => void handleCheckout()}
          >
            {submitting
              ? "A processar..."
              : paymentId
                ? "Aguardando pagamento…"
                : `Pagar com ${METHODS.find((m) => m.id === payMethod)?.title}`}
          </Button>
        </section>
      </div>
    </div>
  );
}
