import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, ShopStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  listConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        OR: [
          { buyerId: userId },
          { shop: { members: { some: { userId, isActive: true } } } },
          { shop: { ownerId: userId } },
        ],
      },
      include: {
        shop: { select: { id: true, name: true, slug: true, logoUrl: true } },
        product: { select: { id: true, name: true, slug: true } },
        buyer: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async start(
    buyerId: string,
    data: { shopId: string; productId?: string; subject?: string },
  ) {
    const shop = await this.prisma.shop.findFirst({
      where: { id: data.shopId, status: ShopStatus.ACTIVE },
    });
    if (!shop) {
      throw new NotFoundException('Loja não encontrada');
    }

    const existing = await this.prisma.conversation.findFirst({
      where: {
        buyerId,
        shopId: data.shopId,
        productId: data.productId ?? null,
      },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.conversation.create({
      data: {
        buyerId,
        shopId: data.shopId,
        productId: data.productId,
        subject: data.subject,
      },
    });
  }

  private async assertAccess(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        shop: { include: { members: { where: { isActive: true } } } },
      },
    });
    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada');
    }
    const isBuyer = conversation.buyerId === userId;
    const isSeller =
      conversation.shop.ownerId === userId ||
      conversation.shop.members.some((m) => m.userId === userId);
    if (!isBuyer && !isSeller) {
      throw new ForbiddenException();
    }
    return { conversation, isBuyer, isSeller };
  }

  async listMessages(conversationId: string, userId: string) {
    await this.assertAccess(conversationId, userId);
    return this.prisma.message.findMany({
      where: { conversationId },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async send(conversationId: string, senderId: string, body: string) {
    const { conversation, isBuyer } = await this.assertAccess(
      conversationId,
      senderId,
    );

    const message = await this.prisma.message.create({
      data: { conversationId, senderId, body },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const recipientId = isBuyer
      ? conversation.shop.ownerId
      : conversation.buyerId;

    await this.notifications.create({
      userId: recipientId,
      type: NotificationType.MESSAGE,
      title: 'Nova mensagem',
      body: body.slice(0, 120),
      href: `/mensagens/${conversationId}`,
    });

    return message;
  }
}
