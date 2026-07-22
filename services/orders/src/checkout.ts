/**
 * Nest OrdersService.checkout parity — Prisma transaction + logistics quote.
 * Shipping quotes via Nest logistics (single adapter/zone source of truth).
 */
import {
  CarrierCode,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  ProductStatus,
  ShopStatus,
} from "@prisma/client";
import type { ShippingQuote } from "@ishopine/shared";

const prisma = new PrismaClient();
const orgSlug = process.env.PLATFORM_ORG_SLUG || "ishopine";
const upstream =
  process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000";

export type CheckoutInput = {
  addressId?: string;
  paymentMethod?: PaymentMethod | string;
  notes?: string;
  couponCode?: string;
  affiliateCode?: string;
  shippingMethod?: "FLAT" | "FREE" | "PICKUP" | "CUSTOM";
  shippingCarrier?: string;
};

function httpError(status: number, message: string) {
  const err = new Error(message);
  (err as Error & { status: number }).status = status;
  return err;
}

function parseCarrierCode(value?: string): CarrierCode {
  if (!value) return CarrierCode.FLAT_RATE;
  if (value === "CORREIOS_MZ") return CarrierCode.MANUAL;
  if (Object.values(CarrierCode).includes(value as CarrierCode)) {
    return value as CarrierCode;
  }
  throw httpError(400, `Carrier inválido: ${value}`);
}

function parsePaymentMethod(value?: string): PaymentMethod {
  if (!value) return PaymentMethod.PIX;
  if (Object.values(PaymentMethod).includes(value as PaymentMethod)) {
    return value as PaymentMethod;
  }
  throw httpError(400, `Método de pagamento inválido: ${value}`);
}

async function nextOrderNumber(tx: {
  order: { count: () => Promise<number> };
}) {
  const count = await tx.order.count();
  return `NK${String(count + 1).padStart(6, "0")}`;
}

async function fetchQuotes(input: {
  shopId: string;
  destinationProvince: string;
  destinationDistrict: string;
  subtotalCents: number;
  weightKg: number;
}): Promise<ShippingQuote[]> {
  const res = await fetch(`${upstream}/api/logistics/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      shopId: input.shopId,
      destinationProvince: input.destinationProvince,
      destinationDistrict: input.destinationDistrict,
      subtotalCents: input.subtotalCents,
      weightKg: input.weightKg,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw httpError(
      502,
      `Falha na cotação de envio (${res.status}): ${text.slice(0, 200)}`,
    );
  }
  const data = (await res.json()) as ShippingQuote[];
  if (!Array.isArray(data) || data.length === 0) {
    throw httpError(502, "Cotação de envio vazia");
  }
  return data;
}

function pickQuote(
  quotes: ShippingQuote[],
  preferredMethod?: string,
  preferredCarrier?: string,
): ShippingQuote {
  if (preferredCarrier) {
    const match = quotes.find((q) => q.carrierCode === preferredCarrier);
    if (match) return match;
  }
  if (preferredMethod) {
    const match = quotes.find((q) => q.method === preferredMethod);
    if (match) return match;
  }
  return (
    quotes.find((q) => q.method === "FREE") ||
    quotes.find((q) => q.method === "FLAT") ||
    quotes[0]
  );
}

export async function runCheckout(buyerId: string, data: CheckoutInput) {
  const buyer = await prisma.user.findUnique({ where: { id: buyerId } });
  if (!buyer?.canBuy) {
    throw httpError(403, "Conta sem permissão de compra");
  }
  if (!buyer.emailVerifiedAt) {
    throw httpError(403, "Verifique seu e-mail antes de comprar");
  }

  const cart = await prisma.cart.findUnique({
    where: { userId: buyerId },
    include: {
      items: {
        include: {
          product: { include: { shop: true } },
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    throw httpError(400, "Carrinho vazio");
  }

  for (const item of cart.items) {
    const available = item.product.stock - item.product.reservedStock;
    if (
      item.product.status !== ProductStatus.ACTIVE ||
      item.product.shop.status !== ShopStatus.ACTIVE ||
      available < item.quantity
    ) {
      throw httpError(
        400,
        `Produto ${item.product.name} sem estoque suficiente`,
      );
    }
  }

  const settings = await prisma.platformSettings.findFirst({
    where: { organization: { slug: orgSlug } },
  });
  const commissionBps = settings?.commissionBps ?? 500;

  let destinationProvince = "Maputo Cidade";
  let destinationDistrict = "KaMpfumo";
  if (data.addressId) {
    const address = await prisma.address.findFirst({
      where: { id: data.addressId, userId: buyerId },
    });
    if (!address) throw httpError(400, "Morada inválida");
    destinationProvince = address.state;
    destinationDistrict = address.district;
  }

  const byShop = new Map<string, typeof cart.items>();
  for (const item of cart.items) {
    const list = byShop.get(item.product.shopId) ?? [];
    list.push(item);
    byShop.set(item.product.shopId, list);
  }

  const shippingByShop = new Map<
    string,
    {
      amountCents: number;
      method: string;
      carrierCode: CarrierCode;
      weightKg: number;
      label: string;
    }
  >();

  for (const [sellerShopId, items] of byShop) {
    const subtotalCents = items.reduce(
      (sum, item) => sum + item.quantity * item.product.priceCents,
      0,
    );
    const weightKg = items.reduce(
      (sum, item) => sum + item.quantity * (item.product.weightKg ?? 0.5),
      0,
    );
    const quotes = await fetchQuotes({
      shopId: sellerShopId,
      destinationProvince,
      destinationDistrict,
      subtotalCents,
      weightKg,
    });
    const quote = pickQuote(
      quotes,
      data.shippingMethod,
      data.shippingCarrier,
    );
    shippingByShop.set(sellerShopId, {
      amountCents: quote.amountCents,
      method: quote.method,
      carrierCode: parseCarrierCode(
        typeof quote.carrierCode === "string" ? quote.carrierCode : undefined,
      ),
      weightKg,
      label: quote.label,
    });
  }

  let coupon: {
    id: string;
    code: string;
    type: "PERCENT" | "FIXED";
    value: number;
    minSubtotalCents: number;
    maxUses: number | null;
    usedCount: number;
    isActive: boolean;
    startsAt: Date;
    endsAt: Date | null;
  } | null = null;

  if (data.couponCode) {
    coupon = await prisma.coupon.findUnique({
      where: { code: data.couponCode.trim().toUpperCase() },
    });
    if (!coupon?.isActive) throw httpError(400, "Cupom inválido");
  }

  const paymentMethod = parsePaymentMethod(
    typeof data.paymentMethod === "string"
      ? data.paymentMethod
      : data.paymentMethod,
  );

  const orders = await prisma.$transaction(async (tx) => {
    const createdOrders = [];
    let couponApplied = false;

    for (const [sellerShopId, items] of byShop) {
      const subtotalCents = items.reduce(
        (sum, item) => sum + item.quantity * item.product.priceCents,
        0,
      );
      const shipping = shippingByShop.get(sellerShopId)!;
      const shippingCents = shipping.amountCents;
      const platformFeeCents = Math.round(
        (subtotalCents * commissionBps) / 10_000,
      );

      let discountCents = 0;
      let appliedCode: string | undefined;
      if (coupon && !couponApplied) {
        const now = new Date();
        if (
          coupon.startsAt <= now &&
          (!coupon.endsAt || coupon.endsAt >= now) &&
          (coupon.maxUses == null || coupon.usedCount < coupon.maxUses) &&
          subtotalCents >= coupon.minSubtotalCents
        ) {
          discountCents =
            coupon.type === "PERCENT"
              ? Math.floor((subtotalCents * coupon.value) / 100)
              : Math.min(coupon.value, subtotalCents);
          appliedCode = coupon.code;
          couponApplied = true;
        }
      }

      const totalCents = Math.max(
        0,
        subtotalCents + shippingCents - discountCents,
      );
      const orderNumber = await nextOrderNumber(tx);

      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { reservedStock: { increment: item.quantity } },
        });
      }

      const created = await tx.order.create({
        data: {
          orderNumber,
          buyerId,
          sellerShopId,
          addressId: data.addressId,
          paymentMethod,
          subtotalCents,
          shippingCents,
          discountCents,
          platformFeeCents,
          totalCents,
          notes: data.notes,
          couponCode: appliedCode,
          affiliateCode: data.affiliateCode?.trim() || undefined,
          events: {
            create: {
              status: OrderStatus.PENDING,
              note: "Pedido criado no iShopine",
            },
          },
          ...(coupon && appliedCode
            ? {
                couponRedemptions: {
                  create: {
                    couponId: coupon.id,
                    amountCents: discountCents,
                  },
                },
              }
            : {}),
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              productName: item.product.name,
              productSku: item.product.sku,
              unitPriceCents: item.product.priceCents,
              quantity: item.quantity,
              totalCents: item.product.priceCents * item.quantity,
            })),
          },
          payments: {
            create: {
              method: paymentMethod,
              amountCents: totalCents,
              status: PaymentStatus.PENDING,
            },
          },
          shipments: {
            create: {
              carrierCode: shipping.carrierCode,
              method: shipping.method,
              amountCents: shipping.amountCents,
              destinationProvince,
              destinationDistrict,
              weightKg: shipping.weightKg,
              status: "PENDING",
              events: {
                create: {
                  status: "PENDING",
                  note: `Cotação ${shipping.label}`,
                },
              },
            },
          },
        },
        include: {
          items: true,
          payments: true,
          address: true,
          sellerShop: {
            select: { id: true, name: true, slug: true },
          },
        },
      });

      createdOrders.push(created);
    }

    if (coupon && couponApplied) {
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } },
      });
    }

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    return createdOrders;
  });

  const result = {
    orders,
    orderCount: orders.length,
    totalCents: orders.reduce((sum, o) => sum + o.totalCents, 0),
  };

  await prisma.outboxMessage.create({
    data: {
      aggregateType: "order",
      aggregateId: orders[0]?.id ?? buyerId,
      eventType: "order.created",
      payload: {
        orderIds: orders.map((o) => o.id),
        orderCount: result.orderCount,
        totalCents: result.totalCents,
        buyerId,
      },
    },
  });

  return result;
}
