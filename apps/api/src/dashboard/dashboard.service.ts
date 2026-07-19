import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccountingEntryStatus,
  OrderStatus,
  PaymentStatus,
  PlatformRole,
  ProductStatus,
  ShopStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async organization() {
    const slug = this.config.get<string>('PLATFORM_ORG_SLUG', 'nkateko');
    const org = await this.prisma.organization.findUnique({
      where: { slug },
      include: { settings: true },
    });
    if (!org) {
      throw new NotFoundException('Organização não encontrada');
    }
    return org;
  }

  async overview() {
    const [
      shopCount,
      activeShops,
      sellerCount,
      productCount,
      activeProducts,
      orderCount,
      pendingOrders,
      buyerCount,
      gmvAgg,
      feeAgg,
      lowStock,
      recentOrders,
      accountingSummary,
    ] = await Promise.all([
      this.prisma.shop.count(),
      this.prisma.shop.count({ where: { status: ShopStatus.ACTIVE } }),
      this.prisma.user.count({
        where: {
          OR: [
            { canSell: true },
            { platformRole: PlatformRole.SELLER },
            { shopMemberships: { some: { isActive: true } } },
          ],
        },
      }),
      this.prisma.product.count(),
      this.prisma.product.count({ where: { status: ProductStatus.ACTIVE } }),
      this.prisma.order.count(),
      this.prisma.order.count({
        where: {
          status: {
            in: [
              OrderStatus.PENDING,
              OrderStatus.CONFIRMED,
              OrderStatus.PROCESSING,
            ],
          },
        },
      }),
      this.prisma.user.count({
        where: { canBuy: true, platformRole: PlatformRole.BUYER },
      }),
      this.prisma.order.aggregate({
        where: { paymentStatus: PaymentStatus.PAID },
        _sum: { totalCents: true },
      }),
      this.prisma.order.aggregate({
        where: { paymentStatus: PaymentStatus.PAID },
        _sum: { platformFeeCents: true },
      }),
      this.prisma.product.count({
        where: {
          stock: { lte: 5 },
          status: {
            in: [ProductStatus.ACTIVE, ProductStatus.OUT_OF_STOCK],
          },
        },
      }),
      this.prisma.order.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          buyer: { select: { name: true, email: true } },
          sellerShop: { select: { name: true, slug: true } },
          items: true,
        },
      }),
      this.prisma.accountingEntry.groupBy({
        by: ['type'],
        where: { status: AccountingEntryStatus.POSTED },
        _sum: { amountCents: true },
      }),
    ]);

    const accounting = Object.fromEntries(
      accountingSummary.map((row) => [row.type, row._sum.amountCents ?? 0]),
    );

    return {
      kpis: {
        shopCount,
        activeShops,
        sellerCount,
        productCount,
        activeProducts,
        orderCount,
        pendingOrders,
        buyerCount,
        customerCount: buyerCount,
        gmvCents: gmvAgg._sum.totalCents ?? 0,
        revenueCents: gmvAgg._sum.totalCents ?? 0,
        platformFeeCents: feeAgg._sum.platformFeeCents ?? 0,
        lowStock,
      },
      accounting,
      recentOrders,
    };
  }

  async platformSettings() {
    const org = await this.organization();
    if (!org.settings) {
      return this.prisma.platformSettings.create({
        data: {
          organizationId: org.id,
          marketplaceName: 'Nkateko Marketplace',
          tagline: 'Mercado aberto de bens — compra e venda',
        },
      });
    }
    return {
      ...org.settings,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        supportEmail: org.supportEmail,
        supportPhone: org.supportPhone,
        logoUrl: org.logoUrl,
        primaryColor: org.primaryColor,
      },
    };
  }

  async updatePlatformSettings(data: {
    marketplaceName?: string;
    tagline?: string;
    shippingFlatCents?: number;
    freeShippingCents?: number;
    requireSeller2fa?: boolean;
    requireEmailVerify?: boolean;
    commissionBps?: number;
    currency?: string;
    supportEmail?: string;
    supportPhone?: string;
    logoUrl?: string;
  }) {
    const org = await this.organization();
    const {
      supportEmail,
      supportPhone,
      logoUrl,
      ...settingsData
    } = data;

    if (
      supportEmail !== undefined ||
      supportPhone !== undefined ||
      logoUrl !== undefined
    ) {
      await this.prisma.organization.update({
        where: { id: org.id },
        data: {
          ...(supportEmail !== undefined ? { supportEmail } : {}),
          ...(supportPhone !== undefined ? { supportPhone } : {}),
          ...(logoUrl !== undefined ? { logoUrl } : {}),
        },
      });
    }

    const current = await this.platformSettings();
    return this.prisma.platformSettings.update({
      where: { id: current.id },
      data: settingsData,
    });
  }
}
