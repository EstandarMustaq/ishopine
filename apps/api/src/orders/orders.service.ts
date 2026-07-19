import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccountingEntryStatus,
  AccountingEntryType,
  InventoryMovementType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PlatformRole,
  ProductStatus,
  ShopStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async nextOrderNumber(tx: {
    order: { count: () => Promise<number> };
  }) {
    const count = await tx.order.count();
    return `NK${String(count + 1).padStart(6, '0')}`;
  }

  async checkout(
    buyerId: string,
    data: {
      addressId?: string;
      paymentMethod?: PaymentMethod;
      notes?: string;
      couponCode?: string;
    },
  ) {
    const buyer = await this.prisma.user.findUnique({ where: { id: buyerId } });
    if (!buyer?.canBuy) {
      throw new ForbiddenException('Conta sem permissão de compra');
    }
    if (!buyer.emailVerifiedAt) {
      throw new ForbiddenException('Verifique seu e-mail antes de comprar');
    }

    const cart = await this.prisma.cart.findUnique({
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
      throw new BadRequestException('Carrinho vazio');
    }

    for (const item of cart.items) {
      const available = item.product.stock - item.product.reservedStock;
      if (
        item.product.status !== ProductStatus.ACTIVE ||
        item.product.shop.status !== ShopStatus.ACTIVE ||
        available < item.quantity
      ) {
        throw new BadRequestException(
          `Produto ${item.product.name} sem estoque suficiente`,
        );
      }
    }

    const orgSlug = this.config.get<string>('PLATFORM_ORG_SLUG', 'ishopine');
    const settings = await this.prisma.platformSettings.findFirst({
      where: { organization: { slug: orgSlug } },
    });
    const freeShipping = settings?.freeShippingCents ?? 99900;
    const flatShipping = settings?.shippingFlatCents ?? 4900;
    const commissionBps = settings?.commissionBps ?? 500;

    const byShop = new Map<string, typeof cart.items>();
    for (const item of cart.items) {
      const list = byShop.get(item.product.shopId) ?? [];
      list.push(item);
      byShop.set(item.product.shopId, list);
    }

    let coupon:
      | {
          id: string;
          code: string;
          type: 'PERCENT' | 'FIXED';
          value: number;
          minSubtotalCents: number;
          maxUses: number | null;
          usedCount: number;
          isActive: boolean;
          startsAt: Date;
          endsAt: Date | null;
        }
      | null = null;

    if (data.couponCode) {
      coupon = await this.prisma.coupon.findUnique({
        where: { code: data.couponCode.trim().toUpperCase() },
      });
      if (!coupon?.isActive) {
        throw new BadRequestException('Cupom inválido');
      }
    }

    const orders = await this.prisma.$transaction(async (tx) => {
      const createdOrders = [];
      let couponApplied = false;

      for (const [sellerShopId, items] of byShop) {
        const subtotalCents = items.reduce(
          (sum, item) => sum + item.quantity * item.product.priceCents,
          0,
        );
        const shippingCents =
          subtotalCents >= freeShipping ? 0 : flatShipping;
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
              coupon.type === 'PERCENT'
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
        const orderNumber = await this.nextOrderNumber(tx);

        for (const item of items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              reservedStock: { increment: item.quantity },
            },
          });
        }

        const created = await tx.order.create({
          data: {
            orderNumber,
            buyerId,
            sellerShopId,
            addressId: data.addressId,
            paymentMethod: data.paymentMethod ?? PaymentMethod.PIX,
            subtotalCents,
            shippingCents,
            discountCents,
            platformFeeCents,
            totalCents,
            notes: data.notes,
            couponCode: appliedCode,
            events: {
              create: {
                status: OrderStatus.PENDING,
                note: 'Pedido criado no iShopine',
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
                method: data.paymentMethod ?? PaymentMethod.PIX,
                amountCents: totalCents,
                status: PaymentStatus.PENDING,
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

    return {
      orders,
      orderCount: orders.length,
      totalCents: orders.reduce((sum, o) => sum + o.totalCents, 0),
    };
  }

  async listForUser(buyerId: string) {
    return this.prisma.order.findMany({
      where: { buyerId },
      include: {
        items: true,
        payments: true,
        address: true,
        sellerShop: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForSeller(userId: string) {
    return this.prisma.order.findMany({
      where: {
        sellerShop: {
          OR: [
            { ownerId: userId },
            { members: { some: { userId, isActive: true } } },
          ],
        },
      },
      include: {
        items: true,
        payments: true,
        buyer: { select: { id: true, name: true, email: true } },
        sellerShop: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAll(query: { status?: OrderStatus; page?: string; limit?: string }) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(50, Math.max(1, Number(query.limit ?? 20)));
    const where = query.status ? { status: query.status } : {};

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          buyer: { select: { id: true, name: true, email: true } },
          sellerShop: { select: { id: true, name: true, slug: true } },
          items: true,
          payments: true,
          address: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getOne(
    id: string,
    user: { id: string; platformRole: PlatformRole },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        buyer: {
          select: { id: true, name: true, email: true, phone: true },
        },
        sellerShop: {
          select: {
            id: true,
            name: true,
            slug: true,
            ownerId: true,
            members: {
              where: { userId: user.id, isActive: true },
              select: { role: true },
            },
          },
        },
        items: { include: { product: { include: { images: true } } } },
        payments: true,
        address: true,
        accountingEntries: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }

    const isPlatform =
      user.platformRole === PlatformRole.PLATFORM_ADMIN ||
      user.platformRole === PlatformRole.PLATFORM_OPERATOR;
    const isBuyer = order.buyerId === user.id;
    const isSeller =
      order.sellerShop.ownerId === user.id ||
      order.sellerShop.members.length > 0;

    if (!isPlatform && !isBuyer && !isSeller) {
      throw new ForbiddenException();
    }

    return order;
  }

  async settlePaidOrders(orderIds: string[]) {
    for (const id of orderIds) {
      const order = await this.prisma.order.findUnique({ where: { id } });
      if (!order) continue;
      if (order.paymentStatus === PaymentStatus.PAID) continue;
      await this.updateStatus(id, OrderStatus.CONFIRMED, order.buyerId);
    }
  }

  async updateStatus(id: string, status: OrderStatus, operatorId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true, payments: true },
    });

    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }

    return this.prisma.$transaction(async (tx) => {
      const data: {
        status: OrderStatus;
        shippedAt?: Date;
        deliveredAt?: Date;
        cancelledAt?: Date;
        paymentStatus?: PaymentStatus;
      } = { status };

      if (status === OrderStatus.SHIPPED) {
        data.shippedAt = new Date();
      }
      if (status === OrderStatus.DELIVERED) {
        data.deliveredAt = new Date();
      }
      if (status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED) {
        data.cancelledAt = new Date();
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              reservedStock: { decrement: item.quantity },
            },
          });
          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              type: InventoryMovementType.RELEASE,
              quantity: item.quantity,
              reason: `Liberação por cancelamento do pedido ${order.orderNumber}`,
              reference: order.id,
              operatorId,
            },
          });
        }
      }

      const shouldFulfill =
        (status === OrderStatus.CONFIRMED ||
          status === OrderStatus.PROCESSING) &&
        order.paymentStatus !== PaymentStatus.PAID;

      if (shouldFulfill) {
        data.paymentStatus = PaymentStatus.PAID;
        await tx.payment.updateMany({
          where: { orderId: order.id },
          data: { status: PaymentStatus.PAID, paidAt: new Date() },
        });

        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { decrement: item.quantity },
              reservedStock: { decrement: item.quantity },
            },
          });
          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              type: InventoryMovementType.OUT,
              quantity: item.quantity,
              reason: `Saída por pedido ${order.orderNumber}`,
              reference: order.id,
              operatorId,
            },
          });
        }

        const cashAccount = await tx.accountingAccount.findUnique({
          where: { code: '1.1.01' },
        });
        const revenueAccount = await tx.accountingAccount.findUnique({
          where: { code: '3.1.01' },
        });

        if (cashAccount && revenueAccount) {
          const existing = await tx.accountingEntry.findFirst({
            where: { orderId: order.id, type: AccountingEntryType.REVENUE },
          });
          if (!existing) {
            const entryCount = await tx.accountingEntry.count();
            await tx.accountingEntry.create({
              data: {
                entryNumber: `LC${String(entryCount + 1).padStart(6, '0')}`,
                description: `Receita do pedido ${order.orderNumber}`,
                type: AccountingEntryType.REVENUE,
                status: AccountingEntryStatus.POSTED,
                amountCents: order.totalCents,
                debitAccountId: cashAccount.id,
                creditAccountId: revenueAccount.id,
                orderId: order.id,
                createdById: operatorId,
                reviewedById: operatorId,
                postedAt: new Date(),
              },
            });
          }
        }
      }

      return tx.order.update({
        where: { id },
        data,
        include: {
          items: true,
          payments: true,
          buyer: { select: { id: true, name: true, email: true } },
          sellerShop: { select: { id: true, name: true, slug: true } },
        },
      });
    });
  }
}
