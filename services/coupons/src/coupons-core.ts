/**
 * Phase 24: coupons core — list/create/validate (Nest CouponsService parity).
 * Checkout redemption stays in orders (Nest + owned).
 */
import { CouponType, PrismaClient } from "@prisma/client";
import { HttpError } from "./http-error";

export const prisma = new PrismaClient();

export { HttpError };

export function listCoupons() {
  return prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
}

export function createCoupon(
  createdById: string,
  data: {
    code: string;
    type: CouponType;
    value: number;
    minSubtotalCents?: number;
    maxUses?: number;
    endsAt?: string;
  },
) {
  return prisma.coupon.create({
    data: {
      code: data.code.trim().toUpperCase(),
      type: data.type,
      value: data.value,
      minSubtotalCents: data.minSubtotalCents ?? 0,
      maxUses: data.maxUses,
      endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
      createdById,
    },
  });
}

export async function validateCoupon(code: string, subtotalCents: number) {
  const coupon = await prisma.coupon.findUnique({
    where: { code: code.trim().toUpperCase() },
  });
  if (!coupon || !coupon.isActive) {
    throw new HttpError(404, "Cupom inválido");
  }
  const now = new Date();
  if (coupon.startsAt > now || (coupon.endsAt && coupon.endsAt < now)) {
    throw new HttpError(400, "Cupom fora do período de validade");
  }
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    throw new HttpError(400, "Cupom esgotado");
  }
  if (subtotalCents < coupon.minSubtotalCents) {
    throw new HttpError(
      400,
      `Pedido mínimo de R$ ${(coupon.minSubtotalCents / 100).toFixed(2)}`,
    );
  }

  const discountCents =
    coupon.type === CouponType.PERCENT
      ? Math.floor((subtotalCents * coupon.value) / 100)
      : Math.min(coupon.value, subtotalCents);

  return {
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    discountCents,
    couponId: coupon.id,
  };
}

/**
 * Phase 25: redeem after order create (idempotent on couponId+orderId).
 * Fail-closed for exhausted / invalid coupons.
 */
export async function redeemCoupon(input: {
  code: string;
  orderId: string;
  amountCents: number;
  subtotalCents: number;
}) {
  if (input.amountCents < 0) {
    throw new HttpError(400, "amountCents inválido");
  }
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: { id: true },
  });
  if (!order) throw new HttpError(404, "Pedido não encontrado");

  const coupon = await prisma.coupon.findUnique({
    where: { code: input.code.trim().toUpperCase() },
  });
  if (!coupon || !coupon.isActive) {
    throw new HttpError(404, "Cupom inválido");
  }

  const existing = await prisma.couponRedemption.findUnique({
    where: {
      couponId_orderId: {
        couponId: coupon.id,
        orderId: input.orderId,
      },
    },
  });
  if (existing) {
    return {
      couponId: coupon.id,
      code: coupon.code,
      discountCents: existing.amountCents,
      alreadyRedeemed: true as const,
    };
  }

  const validated = await validateCoupon(input.code, input.subtotalCents);
  const amountCents =
    input.amountCents > 0 ? input.amountCents : validated.discountCents;

  const redemption = await prisma.$transaction(async (tx) => {
    const fresh = await tx.coupon.findUnique({
      where: { id: validated.couponId },
    });
    if (!fresh?.isActive) throw new HttpError(404, "Cupom inválido");
    if (fresh.maxUses != null && fresh.usedCount >= fresh.maxUses) {
      throw new HttpError(400, "Cupom esgotado");
    }
    const created = await tx.couponRedemption.create({
      data: {
        couponId: fresh.id,
        orderId: input.orderId,
        amountCents,
      },
    });
    await tx.coupon.update({
      where: { id: fresh.id },
      data: { usedCount: { increment: 1 } },
    });
    return created;
  });

  return {
    couponId: validated.couponId,
    code: validated.code,
    discountCents: redemption.amountCents,
    alreadyRedeemed: false as const,
  };
}
