import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AffiliateRewardStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AffiliateService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertEligible(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isActive || !user.canBuy || !user.emailVerifiedAt) {
      throw new ForbiddenException(
        'Recompensas disponíveis apenas para clientes verificados e elegíveis',
      );
    }
    if (!user.affiliateEligible) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { affiliateEligible: true },
      });
    }
    return user;
  }

  async createLink(
    userId: string,
    data: { productId?: string; shopId?: string; label?: string },
  ) {
    await this.assertEligible(userId);
    if (!data.productId && !data.shopId) {
      throw new BadRequestException('Informe um produto ou loja de empresa');
    }
    if (data.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: data.productId },
        include: { shop: true },
      });
      if (!product) throw new NotFoundException('Produto não encontrado');
    }
    if (data.shopId) {
      const shop = await this.prisma.shop.findUnique({ where: { id: data.shopId } });
      if (!shop) throw new NotFoundException('Loja não encontrada');
    }

    const code = `is${randomBytes(4).toString('hex')}`;
    return this.prisma.affiliateLink.create({
      data: {
        userId,
        code,
        productId: data.productId,
        shopId: data.shopId,
        label: data.label,
      },
      include: {
        product: { select: { id: true, name: true, slug: true } },
        shop: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  listMine(userId: string) {
    return this.prisma.affiliateLink.findMany({
      where: { userId },
      include: {
        product: { select: { id: true, name: true, slug: true } },
        shop: { select: { id: true, name: true, slug: true } },
        _count: { select: { rewards: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async summary(userId: string) {
    await this.assertEligible(userId);
    const [links, linkRows, pending, earned] = await Promise.all([
      this.prisma.affiliateLink.count({ where: { userId, isActive: true } }),
      this.prisma.affiliateLink.findMany({
        where: { userId },
        select: { clicks: true },
      }),
      this.prisma.affiliateReward.aggregate({
        where: { earnerId: userId, status: AffiliateRewardStatus.PENDING },
        _sum: { amountCents: true },
      }),
      this.prisma.affiliateReward.aggregate({
        where: {
          earnerId: userId,
          status: { in: [AffiliateRewardStatus.APPROVED, AffiliateRewardStatus.PAID] },
        },
        _sum: { amountCents: true },
      }),
    ]);
    const clicks = linkRows.reduce((n, l) => n + l.clicks, 0);
    const pendingCents = pending._sum.amountCents ?? 0;
    const earnedCents = earned._sum.amountCents ?? 0;
    return {
      eligible: true,
      activeLinks: links,
      linksCount: links,
      clicks,
      pendingCents,
      earnedCents,
      commissionsCents: pendingCents + earnedCents,
      paidCents: earnedCents,
    };
  }

  async trackClick(code: string) {
    const link = await this.prisma.affiliateLink.findUnique({
      where: { code },
      include: {
        product: { select: { id: true, slug: true, name: true } },
        shop: { select: { id: true, slug: true, name: true } },
      },
    });
    if (!link?.isActive) throw new NotFoundException('Link inválido');
    await this.prisma.affiliateLink.update({
      where: { id: link.id },
      data: { clicks: { increment: 1 } },
    });

    let href = '/produtos';
    if (link.product?.slug) {
      href = `/produtos/${link.product.slug}`;
    } else if (link.shop?.slug) {
      href = `/lojas/${link.shop.slug}`;
    }

    return {
      code: link.code,
      productId: link.productId,
      shopId: link.shopId,
      product: link.product,
      shop: link.shop,
      href,
    };
  }

  async listRewards(userId: string) {
    await this.assertEligible(userId);
    return this.prisma.affiliateReward.findMany({
      where: { earnerId: userId },
      include: {
        link: {
          select: {
            code: true,
            label: true,
            product: { select: { name: true, slug: true } },
            shop: { select: { name: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async registerConversion(input: {
    code?: string | null;
    orderId?: string;
    amountCents: number;
  }) {
    if (!input.code) return null;
    const link = await this.prisma.affiliateLink.findUnique({
      where: { code: input.code },
    });
    if (!link?.isActive) return null;

    if (input.orderId) {
      const existing = await this.prisma.affiliateReward.findFirst({
        where: { orderId: input.orderId, linkId: link.id },
      });
      if (existing) return existing;
    }

    const amountCents = Math.max(
      0,
      Math.round((input.amountCents * link.rewardBps) / 10_000),
    );
    if (amountCents <= 0) return null;

    const reward = await this.prisma.$transaction(async (tx) => {
      const created = await tx.affiliateReward.create({
        data: {
          linkId: link.id,
          earnerId: link.userId,
          orderId: input.orderId,
          amountCents,
          status: AffiliateRewardStatus.PENDING,
        },
      });
      await tx.affiliateLink.update({
        where: { id: link.id },
        data: {
          conversions: { increment: 1 },
          pendingCents: { increment: amountCents },
          earnedCents: { increment: amountCents },
        },
      });
      return created;
    });
    return reward;
  }
}
