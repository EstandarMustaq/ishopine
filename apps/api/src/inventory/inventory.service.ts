import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryMovementType, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  listMovements(productId?: string) {
    return this.prisma.inventoryMovement.findMany({
      where: productId ? { productId } : undefined,
      include: {
        product: { select: { id: true, name: true, sku: true, stock: true } },
        operator: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async adjust(
    productId: string,
    data: {
      type: InventoryMovementType;
      quantity: number;
      reason: string;
      operatorId: string;
    },
  ) {
    if (data.quantity <= 0) {
      throw new BadRequestException('Quantidade deve ser positiva');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Produto não encontrado');
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
        throw new BadRequestException(`Tipo inválido: ${_exhaustive}`);
      }
    }

    const nextStock = product.stock + stockDelta;
    if (nextStock < 0) {
      throw new BadRequestException('Estoque resultante não pode ser negativo');
    }

    return this.prisma.$transaction(async (tx) => {
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

  lowStock(threshold = 5) {
    return this.prisma.product.findMany({
      where: {
        stock: { lte: threshold },
        status: { in: [ProductStatus.ACTIVE, ProductStatus.OUT_OF_STOCK] },
      },
      include: {
        images: { take: 1, orderBy: { isPrimary: 'desc' } },
        category: true,
      },
      orderBy: { stock: 'asc' },
    });
  }
}
