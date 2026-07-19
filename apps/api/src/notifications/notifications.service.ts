import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.notification.count({
        where: { userId, readAt: null },
      }),
    ]);
    return { items, unreadCount };
  }

  create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    href?: string;
  }) {
    return this.prisma.notification.create({ data });
  }

  async markRead(userId: string, id: string) {
    const note = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!note) {
      throw new NotFoundException('Notificação não encontrada');
    }
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
