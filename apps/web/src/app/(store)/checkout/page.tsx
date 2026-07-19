"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, Smartphone } from "lucide-react";
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
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  Address,
  Cart,
  CheckoutResult,
  CouponValidation,
  MpesaC2bResponse,
  MpesaStatusResponse,
  StripeCheckoutResponse,
} from "@/lib/types";

type CheckoutPayMethod = "STRIPE" | "MPESA";

function normalizeMsisdn(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("258")) return digits;
  if (digits.startsWith("8") && digits.length === 9) return `258${digits}`;
  return digits;
}

export default function CheckoutPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [cart, setCart] = useState<Cart | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string>("");
  const [payMethod, setPayMethod] = useState<CheckoutPayMethod>("STRIPE");
  const [msisdn, setMsisdn] = useState("");
  const [mpesaPaymentId, setMpesaPaymentId] = useState<string | null>(null);
  const [mpesaStatus, setMpesaStatus] = useState<string | null>(null);
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
      toast.success("Endereço salvo");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao salvar endereço",
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
          `Cupom aplicado: −${formatBRL(result.discountCents)}`,
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

  function startMpesaPolling(paymentId: string) {
    stopPolling();
    let attempts = 0;
    pollRef.current = setInterval(() => {
      attempts += 1;
      void (async () => {
        try {
          const status = await api<MpesaStatusResponse>(
            `/billing/mpesa/status/${paymentId}`,
          );
          setMpesaStatus(status.status);
          const done =
            status.status === "PAID" ||
            status.status === "FAILED" ||
            status.status === "CANCELLED";
          if (done) {
            stopPolling();
            if (status.status === "PAID") {
              toast.success("Pagamento M-Pesa confirmado!");
              router.push("/pagamento/sucesso");
            } else {
              toast.error(status.message || "Pagamento M-Pesa não concluído");
            }
          }
        } catch {
          // keep polling briefly
        }
        if (attempts >= 40) {
          stopPolling();
          toast.message("Aguardando confirmação M-Pesa. Verifique em Pagamentos.");
        }
      })();
    }, 3000);
  }

  async function handleCheckout() {
    if (!addressId) {
      toast.error("Selecione ou cadastre um endereço");
      return;
    }
    if (payMethod === "MPESA") {
      const phone = normalizeMsisdn(msisdn);
      if (phone.length < 9) {
        toast.error("Informe um número M-Pesa válido");
        return;
      }
    }

    setSubmitting(true);
    try {
      const checkout = await api<CheckoutResult>("/orders/checkout", {
        method: "POST",
        body: JSON.stringify({
          addressId,
          paymentMethod: payMethod === "STRIPE" ? "STRIPE" : "MPESA",
          couponCode: coupon?.valid ? coupon.code : undefined,
        }),
      });

      const orderIds = checkout.orders.map((o) => o.id);
      const orderLabel =
        checkout.orders.length === 1
          ? checkout.orders[0].orderNumber
          : `${checkout.orderCount} pedidos`;

      if (payMethod === "STRIPE") {
        const session = await api<StripeCheckoutResponse>(
          "/billing/stripe/checkout",
          {
            method: "POST",
            body: JSON.stringify({ orderIds }),
          },
        );
        const url = session.url ?? session.checkoutUrl;
        if (!url) {
          throw new Error("URL de checkout Stripe não recebida");
        }
        toast.success(`${orderLabel} criado — redirecionando…`);
        window.location.href = url;
        return;
      }

      const phone = normalizeMsisdn(msisdn);
      const mpesa = await api<MpesaC2bResponse>("/billing/mpesa/c2b", {
        method: "POST",
        body: JSON.stringify({ orderIds, msisdn: phone }),
      });
      setMpesaPaymentId(mpesa.paymentId);
      setMpesaStatus(mpesa.status ?? "PENDING");
      toast.success(
        mpesa.message ||
          `${orderLabel} criado. Confirme o pagamento no telemóvel.`,
      );
      if (String(mpesa.status).toUpperCase() === "PAID") {
        stopPolling();
        router.push("/pagamento/sucesso");
        return;
      }
      startMpesaPolling(mpesa.paymentId);
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
        Carregando...
      </div>
    );
  }

  if (!cart?.items?.length) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
        <p className="mt-3 text-[13px] text-zinc-500">Seu carrinho está vazio.</p>
        <Button asChild className="mt-6">
          <Link href="/produtos">Ver produtos</Link>
        </Button>
      </div>
    );
  }

  const discountCents = coupon?.valid ? coupon.discountCents : 0;
  const totalCents = Math.max(0, cart.subtotalCents - discountCents);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
        Checkout
      </h1>
      <p className="mt-1.5 text-[13px] text-zinc-500">
        Confirme o endereço e a forma de pagamento.
      </p>

      <div className="mt-8 space-y-4">
        <section className="glass-panel animate-slide-up p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[14px] font-semibold text-zinc-900">
              Endereço de entrega
            </h2>
            {addresses.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewAddress((v) => !v)}
              >
                {showNewAddress ? "Usar existente" : "Novo endereço"}
              </Button>
            )}
          </div>

          {!showNewAddress && addresses.length > 0 ? (
            <div className="mt-4">
              <Select value={addressId} onValueChange={setAddressId}>
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue placeholder="Selecione um endereço" />
                </SelectTrigger>
                <SelectContent>
                  {addresses.map((addr) => (
                    <SelectItem key={addr.id} value={addr.id}>
                      {addr.label}: {addr.street}, {addr.number} — {addr.city}/
                      {addr.state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="street">Rua</Label>
                <Input
                  id="street"
                  value={newAddress.street}
                  onChange={(e) =>
                    setNewAddress((s) => ({ ...s, street: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="number">Número</Label>
                <Input
                  id="number"
                  value={newAddress.number}
                  onChange={(e) =>
                    setNewAddress((s) => ({ ...s, number: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="complement">Complemento</Label>
                <Input
                  id="complement"
                  value={newAddress.complement}
                  onChange={(e) =>
                    setNewAddress((s) => ({
                      ...s,
                      complement: e.target.value,
                    }))
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
                <Label htmlFor="state">Estado</Label>
                <Input
                  id="state"
                  value={newAddress.state}
                  onChange={(e) =>
                    setNewAddress((s) => ({ ...s, state: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="zipCode">CEP</Label>
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
                  Salvar endereço
                </Button>
              </div>
            </div>
          )}
        </section>

        <section className="glass-panel animate-slide-up p-5">
          <h2 className="text-[14px] font-semibold text-zinc-900">Pagamento</h2>
          <p className="mt-1 text-[12px] text-zinc-500">
            Escolha cartão (Stripe) ou M-Pesa.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setPayMethod("STRIPE")}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-all duration-200",
                payMethod === "STRIPE"
                  ? "border-zinc-900 bg-white shadow-soft"
                  : "border-zinc-200/80 bg-white/40 hover:border-zinc-300",
              )}
            >
              <CreditCard className="mt-0.5 size-4 shrink-0 text-zinc-700" />
              <span>
                <span className="block text-[13px] font-semibold text-zinc-900">
                  Cartão · Stripe
                </span>
                <span className="mt-0.5 block text-[12px] text-zinc-500">
                  Visa, Mastercard e outros
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPayMethod("MPESA")}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-all duration-200",
                payMethod === "MPESA"
                  ? "border-zinc-900 bg-white shadow-soft"
                  : "border-zinc-200/80 bg-white/40 hover:border-zinc-300",
              )}
            >
              <Smartphone className="mt-0.5 size-4 shrink-0 text-zinc-700" />
              <span>
                <span className="block text-[13px] font-semibold text-zinc-900">
                  M-Pesa
                </span>
                <span className="mt-0.5 block text-[12px] text-zinc-500">
                  Pagamento via telemóvel
                </span>
              </span>
            </button>
          </div>

          {payMethod === "MPESA" && (
            <div className="mt-4 animate-fade-in">
              <Label htmlFor="msisdn">Número M-Pesa</Label>
              <Input
                id="msisdn"
                inputMode="tel"
                placeholder="ex: 84xxxxxxx ou 25884xxxxxxx"
                value={msisdn}
                onChange={(e) => setMsisdn(e.target.value)}
                className="mt-1.5"
              />
              <p className="mt-1.5 text-[12px] text-zinc-500">
                Receberá o pedido de confirmação no telemóvel.
              </p>
              {mpesaPaymentId && (
                <p className="mt-3 rounded-xl border border-zinc-200/60 bg-white/60 px-3 py-2 text-[12px] text-zinc-600">
                  Pagamento{" "}
                  <span className="font-mono text-zinc-900">
                    {mpesaPaymentId}
                  </span>
                  {mpesaStatus ? ` · ${mpesaStatus}` : ""} — a aguardar…
                </p>
              )}
            </div>
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
              {validatingCoupon ? "Validando..." : "Aplicar"}
            </Button>
          </div>
          {coupon?.valid && (
            <p className="mt-2 text-[13px] font-medium text-zinc-900">
              Cupom {coupon.code} aplicado (−{formatBRL(coupon.discountCents)})
            </p>
          )}
        </section>

        <section className="glass-panel p-5">
          <div className="flex justify-between text-[13px]">
            <span className="text-zinc-500">Subtotal</span>
            <span className="font-semibold text-zinc-900">
              {formatBRL(cart.subtotalCents)}
            </span>
          </div>
          {discountCents > 0 && (
            <div className="mt-2 flex justify-between text-[13px]">
              <span className="text-zinc-500">Desconto</span>
              <span className="font-semibold text-zinc-900">
                −{formatBRL(discountCents)}
              </span>
            </div>
          )}
          <div className="mt-2 flex justify-between text-[13px]">
            <span className="text-zinc-500">Total</span>
            <span className="font-semibold text-zinc-900">
              {formatBRL(totalCents)}
            </span>
          </div>
          <p className="mt-2 text-[12px] text-zinc-500">
            O frete será calculado pela loja no pedido.
          </p>
          <Button
            className="mt-5 w-full"
            disabled={submitting || Boolean(mpesaPaymentId)}
            onClick={() => void handleCheckout()}
          >
            {submitting
              ? "Processando..."
              : payMethod === "STRIPE"
                ? "Pagar com cartão"
                : mpesaPaymentId
                  ? "Aguardando M-Pesa…"
                  : "Pagar com M-Pesa"}
          </Button>
        </section>
      </div>
    </div>
  );
}
