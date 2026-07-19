import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DisputeStatus,
  NotificationType,
  PlatformRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    userId: string,
    data: { orderId: string; reason: string; description: string },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { sellerShop: true },
    });
    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }
    if (order.buyerId !== userId) {
      throw new ForbiddenException('Apenas o comprador pode abrir disputa');
    }

    const existing = await this.prisma.dispute.findFirst({
      where: {
        orderId: order.id,
        status: { in: [DisputeStatus.OPEN, DisputeStatus.IN_REVIEW] },
      },
    });
    if (existing) {
      throw new BadRequestException('Já existe disputa aberta para este pedido');
    }

    const dispute = await this.prisma.dispute.create({
      data: {
        orderId: order.id,
        openedById: userId,
        reason: data.reason,
        description: data.description,
      },
    });

    await this.notifications.create({
      userId: order.sellerShop.ownerId,
      type: NotificationType.DISPUTE,
      title: 'Nova disputa',
      body: `Pedido ${order.orderNumber}: ${data.reason}`,
      href: '/painel/disputas',
    });

    return dispute;
  }

  listForUser(userId: string, role: PlatformRole) {
    if (
      role === PlatformRole.PLATFORM_ADMIN ||
      role === PlatformRole.PLATFORM_OPERATOR
    ) {
      return this.prisma.dispute.findMany({
        include: {
          order: {
            include: {
              buyer: { select: { name: true, email: true } },
              sellerShop: { select: { name: true, slug: true } },
            },
          },
          openedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.dispute.findMany({
      where: {
        OR: [
          { openedById: userId },
          { order: { sellerShop: { ownerId: userId } } },
          {
            order: {
              sellerShop: {
                members: { some: { userId, isActive: true } },
              },
            },
          },
        ],
      },
      include: {
        order: {
          include: {
            sellerShop: { select: { name: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolve(
    id: string,
    status: DisputeStatus,
    resolution: string,
    actorRole: PlatformRole,
  ) {
    if (
      actorRole !== PlatformRole.PLATFORM_ADMIN &&
      actorRole !== PlatformRole.PLATFORM_OPERATOR
    ) {
      throw new ForbiddenException();
    }

    const dispute = await this.prisma.dispute.findUnique({ where: { id } });
    if (!dispute) {
      throw new NotFoundException();
    }

    return this.prisma.dispute.update({
      where: { id },
      data: {
        status,
        resolution,
        resolvedAt: new Date(),
      },
    });
  }
}
