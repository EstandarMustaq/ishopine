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
