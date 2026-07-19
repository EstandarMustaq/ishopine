import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountingEntryStatus,
  AccountingEntryType,
  InventoryMovementType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private async nextOrderNumber() {
    const count = await this.prisma.order.count();
    return `MV${String(count + 1).padStart(6, '0')}`;
  }

  private async nextEntryNumber() {
    const count = await this.prisma.accountingEntry.count();
    return `LC${String(count + 1).padStart(6, '0')}`;
  }

  async checkout(
    userId: string,
    data: {
      addressId?: string;
      paymentMethod?: PaymentMethod;
      notes?: string;
    },
  ) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: { include: { product: true } },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Carrinho vazio');
    }

    for (const item of cart.items) {
      const available = item.product.stock - item.product.reservedStock;
      if (
        item.product.status !== ProductStatus.ACTIVE ||
        available < item.quantity
      ) {
        throw new BadRequestException(
          `Produto ${item.product.name} sem estoque suficiente`,
        );
      }
    }

    const settings = await this.prisma.storeSettings.findFirst();
    const subtotalCents = cart.items.reduce(
      (sum, item) => sum + item.quantity * item.product.priceCents,
      0,
    );
    const freeShipping = settings?.freeShippingCents ?? 99900;
    const shippingCents =
      subtotalCents >= freeShipping ? 0 : (settings?.shippingFlatCents ?? 4900);
    const totalCents = subtotalCents + shippingCents;

    const orderNumber = await this.nextOrderNumber();

    const order = await this.prisma.$transaction(async (tx) => {
      for (const item of cart.items) {
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
          userId,
          addressId: data.addressId,
          paymentMethod: data.paymentMethod ?? PaymentMethod.PIX,
          subtotalCents,
          shippingCents,
          totalCents,
          notes: data.notes,
          items: {
            create: cart.items.map((item) => ({
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
        },
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return created;
    });

    return order;
  }

  async listForUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: true,
        payments: true,
        address: true,
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
          user: { select: { id: true, name: true, email: true } },
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

  async getOne(id: string, user: { id: string; role: Role }) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        items: { include: { product: { include: { images: true } } } },
        payments: true,
        address: true,
        accountingEntries: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }

    if (
      user.role === Role.CUSTOMER &&
      order.userId !== user.id
    ) {
      throw new ForbiddenException();
    }

    return order;
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    operatorId: string,
  ) {
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
          user: { select: { id: true, name: true, email: true } },
        },
      });
    });
  }
}
