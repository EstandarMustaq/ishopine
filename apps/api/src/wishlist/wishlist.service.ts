import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.wishlistItem.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            images: { orderBy: { isPrimary: 'desc' }, take: 1 },
            shop: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async add(userId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: ProductStatus.ACTIVE },
    });
    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    return this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
      include: { product: true },
    });
  }

  async remove(userId: string, productId: string) {
    await this.prisma.wishlistItem.deleteMany({
      where: { userId, productId },
    });
    return { ok: true };
  }
}
