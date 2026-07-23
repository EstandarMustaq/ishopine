/**
 * Phase 24: reviews core — list/create for /api/products/:id/reviews (Nest parity).
 */
import { OrderStatus, PrismaClient } from "@prisma/client";
import { HttpError } from "./http-error";

export const prisma = new PrismaClient();

export { HttpError };

export function listForProduct(productId: string) {
  return prisma.review.findMany({
    where: { productId },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createReview(
  userId: string,
  productId: string,
  data: { rating: number; title?: string; comment?: string },
) {
  if (data.rating < 1 || data.rating > 5) {
    throw new HttpError(400, "Avaliação deve ser entre 1 e 5");
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });
  if (!product) {
    throw new HttpError(404, "Produto não encontrado");
  }

  const purchased = await prisma.orderItem.findFirst({
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
    throw new HttpError(
      400,
      "Só é possível avaliar produtos que você comprou",
    );
  }

  const review = await prisma.review.upsert({
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

  const agg = await prisma.review.aggregate({
    where: { shopId: product.shopId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await prisma.shop.update({
    where: { id: product.shopId },
    data: {
      ratingAvg: agg._avg.rating ?? 0,
      ratingCount: agg._count.rating,
    },
  });

  return review;
}
