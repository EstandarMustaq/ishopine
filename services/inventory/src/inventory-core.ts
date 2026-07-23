/**
 * Phase 24: inventory core — movements / adjust / low-stock (Nest parity).
 * Order checkout reserve/release stays in orders (Nest + owned).
 */
import {
  InventoryMovementType,
  ProductStatus,
  PrismaClient,
} from "@prisma/client";
import { HttpError } from "./http-error";

export const prisma = new PrismaClient();

export { HttpError };

export function listMovements(productId?: string) {
  return prisma.inventoryMovement.findMany({
    where: productId ? { productId } : undefined,
    include: {
      product: { select: { id: true, name: true, sku: true, stock: true } },
      operator: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function adjust(
  productId: string,
  data: {
    type: InventoryMovementType;
    quantity: number;
    reason: string;
    operatorId: string;
  },
) {
  if (data.quantity <= 0) {
    throw new HttpError(400, "Quantidade deve ser positiva");
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });
  if (!product) {
    throw new HttpError(404, "Produto não encontrado");
  }

  let stockDelta = 0;
  switch (data.type) {
    case InventoryMovementType.IN:
      stockDelta = data.quantity;
      break;
    case InventoryMovementType.OUT:
    case InventoryMovementType.RESERVE:
      stockDelta = -data.quantity;
      break;
    case InventoryMovementType.ADJUSTMENT:
      stockDelta = data.quantity - product.stock;
      break;
    case InventoryMovementType.RELEASE:
      stockDelta = 0;
      break;
    default: {
      const _exhaustive: never = data.type;
      throw new HttpError(400, `Tipo inválido: ${_exhaustive}`);
    }
  }

  const nextStock = product.stock + stockDelta;
  if (nextStock < 0) {
    throw new HttpError(400, "Estoque resultante não pode ser negativo");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id: productId },
      data: {
        stock: nextStock,
        status:
          nextStock === 0 && product.status === ProductStatus.ACTIVE
            ? ProductStatus.OUT_OF_STOCK
            : nextStock > 0 && product.status === ProductStatus.OUT_OF_STOCK
              ? ProductStatus.ACTIVE
              : product.status,
      },
    });

    const movement = await tx.inventoryMovement.create({
      data: {
        productId,
        type: data.type,
        quantity: data.quantity,
        reason: data.reason,
        operatorId: data.operatorId,
      },
    });

    return { product: updated, movement };
  });
}

export function lowStock(threshold = 5) {
  return prisma.product.findMany({
    where: {
      stock: { lte: threshold },
      status: { in: [ProductStatus.ACTIVE, ProductStatus.OUT_OF_STOCK] },
    },
    include: {
      images: { take: 1, orderBy: { isPrimary: "desc" } },
      category: true,
    },
    orderBy: { stock: "asc" },
  });
}
