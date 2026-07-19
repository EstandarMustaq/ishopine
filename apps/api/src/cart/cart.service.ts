import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureCart(userId: string) {
    return this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async getCart(userId: string) {
    const cart = await this.ensureCart(userId);
    const full = await this.prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        items: {
          include: {
            product: {
              include: {
                shop: {
                  select: { id: true, name: true, slug: true, status: true },
                },
                images: {
                  orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    const items = full?.items ?? [];
    const subtotalCents = items.reduce(
      (sum, item) => sum + item.quantity * item.product.priceCents,
      0,
    );

    return { ...full, subtotalCents, itemCount: items.length };
  }

  async addItem(userId: string, productId: string, quantity = 1) {
    if (quantity < 1) {
      throw new BadRequestException('Quantidade inválida');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || product.status !== ProductStatus.ACTIVE) {
      throw new NotFoundException('Produto indisponível');
    }

    if (product.stock - product.reservedStock < quantity) {
      throw new BadRequestException('Estoque insuficiente');
    }

    const cart = await this.ensureCart(userId);
    const existing = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: { cartId: cart.id, productId },
      },
    });

    const nextQty = (existing?.quantity ?? 0) + quantity;
    if (product.stock - product.reservedStock < nextQty) {
      throw new BadRequestException('Estoque insuficiente');
    }

    await this.prisma.cartItem.upsert({
      where: {
        cartId_productId: { cartId: cart.id, productId },
      },
      create: { cartId: cart.id, productId, quantity },
      update: { quantity: nextQty },
    });

    return this.getCart(userId);
  }

  async updateItem(userId: string, productId: string, quantity: number) {
    const cart = await this.ensureCart(userId);

    if (quantity <= 0) {
      await this.prisma.cartItem.deleteMany({
        where: { cartId: cart.id, productId },
      });
      return this.getCart(userId);
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }
    if (product.stock - product.reservedStock < quantity) {
      throw new BadRequestException('Estoque insuficiente');
    }

    await this.prisma.cartItem.update({
      where: {
        cartId_productId: { cartId: cart.id, productId },
      },
      data: { quantity },
    });

    return this.getCart(userId);
  }

  async removeItem(userId: string, productId: string) {
    const cart = await this.ensureCart(userId);
    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id, productId },
    });
    return this.getCart(userId);
  }

  async clear(userId: string) {
    const cart = await this.ensureCart(userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getCart(userId);
  }
}
