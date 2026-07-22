/**
 * Phase 22: comms core — notifications, conversations/messages, disputes.
 * Nest outbox may still create notifications in-process.
 */
import {
  DisputeStatus,
  NotificationType,
  PlatformRole,
  Prisma,
  PrismaClient,
  ShopStatus,
} from "@prisma/client";
import { HttpError } from "./http-error";

export const prisma = new PrismaClient();
export { HttpError };

/* ── Notifications ─────────────────────────────────────────────── */

export async function listNotifications(userId: string) {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({
      where: { userId, readAt: null },
    }),
  ]);
  return { items, unreadCount };
}

export function createNotification(data: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      title: data.title,
      body: data.body,
      href: data.href,
      metadata: data.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function markNotificationRead(userId: string, id: string) {
  const note = await prisma.notification.findFirst({
    where: { id, userId },
  });
  if (!note) {
    throw new HttpError(404, "Notificação não encontrada");
  }
  return prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { ok: true };
}

/* ── Conversations / messages ──────────────────────────────────── */

export function listConversations(userId: string) {
  return prisma.conversation.findMany({
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
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function startConversation(
  buyerId: string,
  data: { shopId: string; productId?: string; subject?: string },
) {
  const shop = await prisma.shop.findFirst({
    where: { id: data.shopId, status: ShopStatus.ACTIVE },
  });
  if (!shop) {
    throw new HttpError(404, "Loja não encontrada");
  }

  const existing = await prisma.conversation.findFirst({
    where: {
      buyerId,
      shopId: data.shopId,
      productId: data.productId ?? null,
    },
  });
  if (existing) {
    return existing;
  }

  return prisma.conversation.create({
    data: {
      buyerId,
      shopId: data.shopId,
      productId: data.productId,
      subject: data.subject,
    },
  });
}

async function assertConversationAccess(
  conversationId: string,
  userId: string,
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      shop: { include: { members: { where: { isActive: true } } } },
    },
  });
  if (!conversation) {
    throw new HttpError(404, "Conversa não encontrada");
  }
  const isBuyer = conversation.buyerId === userId;
  const isSeller =
    conversation.shop.ownerId === userId ||
    conversation.shop.members.some((m) => m.userId === userId);
  if (!isBuyer && !isSeller) {
    throw new HttpError(403, "Forbidden");
  }
  return { conversation, isBuyer, isSeller };
}

export async function listMessages(conversationId: string, userId: string) {
  await assertConversationAccess(conversationId, userId);
  return prisma.message.findMany({
    where: { conversationId },
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
) {
  const { conversation, isBuyer } = await assertConversationAccess(
    conversationId,
    senderId,
  );

  const message = await prisma.message.create({
    data: { conversationId, senderId, body },
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  const recipientId = isBuyer
    ? conversation.shop.ownerId
    : conversation.buyerId;

  await createNotification({
    userId: recipientId,
    type: NotificationType.MESSAGE,
    title: "Nova mensagem",
    body: body.slice(0, 120),
    href: `/mensagens/${conversationId}`,
  });

  return message;
}

/* ── Disputes ──────────────────────────────────────────────────── */

export async function createDispute(
  userId: string,
  data: { orderId: string; reason: string; description: string },
) {
  const order = await prisma.order.findUnique({
    where: { id: data.orderId },
    include: { sellerShop: true },
  });
  if (!order) {
    throw new HttpError(404, "Pedido não encontrado");
  }
  if (order.buyerId !== userId) {
    throw new HttpError(403, "Apenas o comprador pode abrir disputa");
  }

  const existing = await prisma.dispute.findFirst({
    where: {
      orderId: order.id,
      status: { in: [DisputeStatus.OPEN, DisputeStatus.IN_REVIEW] },
    },
  });
  if (existing) {
    throw new HttpError(400, "Já existe disputa aberta para este pedido");
  }

  const dispute = await prisma.dispute.create({
    data: {
      orderId: order.id,
      openedById: userId,
      reason: data.reason,
      description: data.description,
    },
  });

  await createNotification({
    userId: order.sellerShop.ownerId,
    type: NotificationType.DISPUTE,
    title: "Nova disputa",
    body: `Pedido ${order.orderNumber}: ${data.reason}`,
    href: "/painel/disputas",
  });

  return dispute;
}

export function listDisputes(userId: string, role: PlatformRole) {
  if (
    role === PlatformRole.PLATFORM_ADMIN ||
    role === PlatformRole.PLATFORM_OPERATOR
  ) {
    return prisma.dispute.findMany({
      include: {
        order: {
          include: {
            buyer: { select: { name: true, email: true } },
            sellerShop: { select: { name: true, slug: true } },
          },
        },
        openedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  return prisma.dispute.findMany({
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
    orderBy: { createdAt: "desc" },
  });
}

export async function resolveDispute(
  id: string,
  status: DisputeStatus,
  resolution: string,
  actorRole: PlatformRole,
) {
  if (
    actorRole !== PlatformRole.PLATFORM_ADMIN &&
    actorRole !== PlatformRole.PLATFORM_OPERATOR
  ) {
    throw new HttpError(403, "Forbidden");
  }

  const dispute = await prisma.dispute.findUnique({ where: { id } });
  if (!dispute) {
    throw new HttpError(404, "Not Found");
  }

  return prisma.dispute.update({
    where: { id },
    data: {
      status,
      resolution,
      resolvedAt: new Date(),
    },
  });
}
