import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  listForProduct(productId: string) {
    return this.prisma.review.findMany({
      where: { productId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    userId: string,
    productId: string,
    data: { rating: number; title?: string; comment?: string },
  ) {
    if (data.rating < 1 || data.rating > 5) {
      throw new BadRequestException('Avaliação deve ser entre 1 e 5');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    const purchased = await this.prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          buyerId: userId,
          status: {
            in: [
              OrderStatus.DELIVERED,
              OrderStatus.CONFIRMED,
              OrderStatus.PROCESSING,
              OrderStatus.SHIPPED,
            ],
          },
        },
      },
    });

    if (!purchased) {
      throw new BadRequestException(
        'Só é possível avaliar produtos que você comprou',
      );
    }

    const review = await this.prisma.review.upsert({
      where: { userId_productId: { userId, productId } },
      create: {
        userId,
        productId,
        shopId: product.shopId,
        rating: data.rating,
        title: data.title,
        comment: data.comment,
      },
      update: {
        rating: data.rating,
        title: data.title,
        comment: data.comment,
      },
    });

    const agg = await this.prisma.review.aggregate({
      where: { shopId: product.shopId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await this.prisma.shop.update({
      where: { id: product.shopId },
      data: {
        ratingAvg: agg._avg.rating ?? 0,
        ratingCount: agg._count.rating,
      },
    });

    return review;
  }
}
