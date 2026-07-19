import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CouponType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(
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
    return this.prisma.coupon.create({
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

  async validate(code: string, subtotalCents: number) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
    if (!coupon || !coupon.isActive) {
      throw new NotFoundException('Cupom inválido');
    }
    const now = new Date();
    if (coupon.startsAt > now || (coupon.endsAt && coupon.endsAt < now)) {
      throw new BadRequestException('Cupom fora do período de validade');
    }
    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('Cupom esgotado');
    }
    if (subtotalCents < coupon.minSubtotalCents) {
      throw new BadRequestException(
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
}
