/**
 * Phase 27: platform settings + staff dashboard KPIs (Nest DashboardService parity).
 */
import {
  AccountingEntryStatus,
  OrderStatus,
  PaymentStatus,
  PlatformRole,
  PrismaClient,
  ProductStatus,
  ShopStatus,
} from "@prisma/client";
import { HttpError } from "./http-error";

export const prisma = new PrismaClient();
export { HttpError };

const orgSlug = process.env.PLATFORM_ORG_SLUG || "ishopine";

async function organization() {
  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: { settings: true },
  });
  if (!org) {
    throw new HttpError(404, "Organização não encontrada");
  }
  return org;
}

export async function overview() {
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
    prisma.shop.count(),
    prisma.shop.count({ where: { status: ShopStatus.ACTIVE } }),
    prisma.user.count({
      where: {
        OR: [
          { canSell: true },
          { platformRole: PlatformRole.SELLER },
          { shopMemberships: { some: { isActive: true } } },
        ],
      },
    }),
    prisma.product.count(),
    prisma.product.count({ where: { status: ProductStatus.ACTIVE } }),
    prisma.order.count(),
    prisma.order.count({
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
    prisma.user.count({
      where: { canBuy: true, platformRole: PlatformRole.BUYER },
    }),
    prisma.order.aggregate({
      where: { paymentStatus: PaymentStatus.PAID },
      _sum: { totalCents: true },
    }),
    prisma.order.aggregate({
      where: { paymentStatus: PaymentStatus.PAID },
      _sum: { platformFeeCents: true },
    }),
    prisma.product.count({
      where: {
        stock: { lte: 5 },
        status: {
          in: [ProductStatus.ACTIVE, ProductStatus.OUT_OF_STOCK],
        },
      },
    }),
    prisma.order.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        buyer: { select: { name: true, email: true } },
        sellerShop: { select: { name: true, slug: true } },
        items: true,
      },
    }),
    prisma.accountingEntry.groupBy({
      by: ["type"],
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

export async function charts() {
  const days = 30;
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const [orders, byStatus] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: since } },
      select: {
        createdAt: true,
        totalCents: true,
        paymentStatus: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const bucket = new Map<
    string,
    { date: string; orders: number; gmvCents: number }
  >();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    bucket.set(key, { date: key, orders: 0, gmvCents: 0 });
  }

  for (const order of orders) {
    const key = order.createdAt.toISOString().slice(0, 10);
    const row = bucket.get(key);
    if (!row) continue;
    row.orders += 1;
    if (order.paymentStatus === PaymentStatus.PAID) {
      row.gmvCents += order.totalCents;
    }
  }

  return {
    series: Array.from(bucket.values()),
    ordersByStatus: byStatus.map((row) => ({
      status: row.status,
      count: row._count._all,
    })),
  };
}

export async function platformSettings() {
  const org = await organization();
  if (!org.settings) {
    return prisma.platformSettings.create({
      data: {
        organizationId: org.id,
        marketplaceName: "iShopine",
        tagline: "Mercado aberto — compre e venda com confiança",
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

export async function updatePlatformSettings(data: {
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
  const org = await organization();
  const { supportEmail, supportPhone, logoUrl, ...settingsData } = data;

  if (
    supportEmail !== undefined ||
    supportPhone !== undefined ||
    logoUrl !== undefined
  ) {
    await prisma.organization.update({
      where: { id: org.id },
      data: {
        ...(supportEmail !== undefined ? { supportEmail } : {}),
        ...(supportPhone !== undefined ? { supportPhone } : {}),
        ...(logoUrl !== undefined ? { logoUrl } : {}),
      },
    });
  }

  const current = await platformSettings();
  return prisma.platformSettings.update({
    where: { id: current.id },
    data: settingsData,
  });
}
