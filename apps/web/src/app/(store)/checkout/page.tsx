"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
import type {
  Address,
  Cart,
  CouponValidation,
  Order,
  PaymentMethod,
} from "@/lib/types";

const paymentLabels: Record<PaymentMethod, string> = {
  PIX: "Pix",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  BANK_TRANSFER: "Transferência",
  CASH: "Dinheiro",
};

export default function CheckoutPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [cart, setCart] = useState<Cart | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PIX");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<CouponValidation | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [newAddress, setNewAddress] = useState({
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
    zipCode: "",
  });

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

  async function handleCheckout() {
    if (!addressId) {
      toast.error("Selecione ou cadastre um endereço");
      return;
    }
    setSubmitting(true);
    try {
      const order = await api<Order>("/orders/checkout", {
        method: "POST",
        body: JSON.stringify({
          addressId,
          paymentMethod,
          couponCode: coupon?.valid ? coupon.code : undefined,
        }),
      });
      toast.success(`Pedido ${order.orderNumber} realizado!`);
      router.push("/conta");
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
        <h1 className="text-2xl font-bold">Checkout</h1>
        <p className="mt-3 text-sm text-taupe">
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
      <div className="py-20 text-center text-sm text-taupe">Carregando...</div>
    );
  }

  if (!cart?.items?.length) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Checkout</h1>
        <p className="mt-3 text-sm text-taupe">Seu carrinho está vazio.</p>
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
      <h1 className="text-3xl font-bold text-charcoal">Checkout</h1>
      <p className="mt-2 text-sm text-taupe">
        Confirme o endereço e a forma de pagamento.
      </p>

      <div className="mt-8 space-y-8">
        <section className="rounded-[12px] border border-border p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Endereço de entrega</h2>
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
                <SelectTrigger className="h-11 rounded-[16px]">
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

        <section className="rounded-[12px] border border-border p-5">
          <h2 className="font-semibold">Pagamento</h2>
          <div className="mt-4">
            <Select
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
            >
              <SelectTrigger className="h-11 rounded-[16px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(paymentLabels) as PaymentMethod[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {paymentLabels[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="rounded-[12px] border border-border p-5">
          <h2 className="font-semibold">Cupom</h2>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
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
            <p className="mt-2 text-sm text-[#61005D]">
              Cupom {coupon.code} aplicado (−{formatBRL(coupon.discountCents)})
            </p>
          )}
        </section>

        <section className="rounded-[12px] bg-beige p-5">
          <div className="flex justify-between text-sm">
            <span className="text-taupe">Subtotal</span>
            <span className="font-bold">{formatBRL(cart.subtotalCents)}</span>
          </div>
          {discountCents > 0 && (
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-taupe">Desconto</span>
              <span className="font-bold text-[#61005D]">
                −{formatBRL(discountCents)}
              </span>
            </div>
          )}
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-taupe">Total</span>
            <span className="font-bold">{formatBRL(totalCents)}</span>
          </div>
          <p className="mt-2 text-xs text-taupe">
            O frete será calculado pela loja no pedido.
          </p>
          <Button
            className="mt-6 w-full"
            disabled={submitting}
            onClick={handleCheckout}
          >
            {submitting ? "Processando..." : "Confirmar pedido"}
          </Button>
        </section>
      </div>
    </div>
  );
}
