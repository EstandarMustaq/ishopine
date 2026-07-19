import { Injectable } from '@nestjs/common';
import {
  AccountingEntryStatus,
  OrderStatus,
  PaymentStatus,
  ProductStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [
      productCount,
      activeProducts,
      orderCount,
      pendingOrders,
      customerCount,
      revenueAgg,
      lowStock,
      recentOrders,
      accountingSummary,
    ] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.count({ where: { status: ProductStatus.ACTIVE } }),
      this.prisma.order.count(),
      this.prisma.order.count({
        where: {
          status: {
            in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING],
          },
        },
      }),
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
      this.prisma.order.aggregate({
        where: { paymentStatus: PaymentStatus.PAID },
        _sum: { totalCents: true },
      }),
      this.prisma.product.count({
        where: {
          stock: { lte: 5 },
          status: { in: [ProductStatus.ACTIVE, ProductStatus.OUT_OF_STOCK] },
        },
      }),
      this.prisma.order.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
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
        productCount,
        activeProducts,
        orderCount,
        pendingOrders,
        customerCount,
        revenueCents: revenueAgg._sum.totalCents ?? 0,
        lowStock,
      },
      accounting,
      recentOrders,
    };
  }

  async storeSettings() {
    let settings = await this.prisma.storeSettings.findFirst();
    if (!settings) {
      settings = await this.prisma.storeSettings.create({ data: {} });
    }
    return settings;
  }

  async updateStoreSettings(data: {
    storeName?: string;
    tagline?: string;
    supportEmail?: string;
    supportPhone?: string;
    shippingFlatCents?: number;
    freeShippingCents?: number;
    logoUrl?: string;
  }) {
    const current = await this.storeSettings();
    return this.prisma.storeSettings.update({
      where: { id: current.id },
      data,
    });
  }
}
