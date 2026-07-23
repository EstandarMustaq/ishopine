/**
 * Phase 28: users admin + reliability ops + outbox tick (Nest parity).
 * Reliability engine writers / idempotency interceptor stay in Nest.
 */
import { createHash, createHmac, randomBytes } from "node:crypto";
import {
  InboxStatus,
  NotificationType,
  OutboxStatus,
  PlatformRole,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { HttpError } from "./http-error";
import { RELIABILITY_RULES, outboxBackoffMs } from "./rules";

export const prisma = new PrismaClient();
export { HttpError };

const PLATFORM_ROLES = new Set<string>(Object.values(PlatformRole));

function checksum(data: unknown): string {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex").slice(0, 32);
}

/* ── Users admin ───────────────────────────────────────────────── */

export function listUsers(platformRole?: PlatformRole) {
  return prisma.user.findMany({
    where: platformRole ? { platformRole } : undefined,
    select: {
      id: true,
      email: true,
      name: true,
      platformRole: true,
      phone: true,
      isActive: true,
      canBuy: true,
      canSell: true,
      totpEnabled: true,
      emailVerifiedAt: true,
      createdAt: true,
      _count: {
        select: {
          buyerOrders: true,
          ownedShops: true,
          shopMemberships: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateUserRole(id: string, platformRole: PlatformRole) {
  if (!PLATFORM_ROLES.has(platformRole)) {
    throw new HttpError(400, "Papel inválido");
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new HttpError(404, "Usuário não encontrado");
  }
  return prisma.user.update({
    where: { id },
    data: {
      platformRole,
      canSell:
        platformRole === PlatformRole.SELLER ||
        platformRole === PlatformRole.PLATFORM_ADMIN ||
        platformRole === PlatformRole.PLATFORM_OPERATOR
          ? true
          : user.canSell,
    },
    select: {
      id: true,
      email: true,
      name: true,
      platformRole: true,
      isActive: true,
      canSell: true,
    },
  });
}

export async function setUserActive(id: string, isActive: boolean) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new HttpError(404, "Usuário não encontrado");
  }
  return prisma.user.update({
    where: { id },
    data: { isActive },
    select: {
      id: true,
      email: true,
      name: true,
      platformRole: true,
      isActive: true,
    },
  });
}

export function parsePlatformRole(value: unknown): PlatformRole | undefined {
  if (typeof value !== "string" || !PLATFORM_ROLES.has(value)) return undefined;
  return value as PlatformRole;
}

/* ── Projections ───────────────────────────────────────────────── */

async function upsertProjection(
  name: string,
  partitionKey: string,
  data: unknown,
  bumpVersion = true,
) {
  const sum = checksum(data);
  const existing = await prisma.readProjection.findUnique({
    where: { name_partitionKey: { name, partitionKey } },
  });

  if (existing?.checksum === sum) {
    return { projection: existing, changed: false };
  }

  const projection = await prisma.readProjection.upsert({
    where: { name_partitionKey: { name, partitionKey } },
    create: {
      name,
      partitionKey,
      data: data as Prisma.InputJsonValue,
      checksum: sum,
      version: 1,
      projectedAt: new Date(),
    },
    update: {
      data: data as Prisma.InputJsonValue,
      checksum: sum,
      version: bumpVersion ? { increment: 1 } : undefined,
      projectedAt: new Date(),
    },
  });
  return { projection, changed: true };
}

export async function getProjection<T = unknown>(
  name: string,
  partitionKey: string,
): Promise<T | null> {
  const row = await prisma.readProjection.findUnique({
    where: { name_partitionKey: { name, partitionKey } },
  });
  return (row?.data as T) ?? null;
}

export async function projectBuyerBilling(buyerId: string) {
  const payments = await prisma.billingPayment.findMany({
    where: { buyerId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      amountCents: true,
      currency: true,
      method: true,
      reference: true,
      paidAt: true,
      createdAt: true,
    },
  });

  const paid = payments.filter((p) => p.status === "PAID");
  const data = {
    buyerId,
    paymentCount: payments.length,
    paidCount: paid.length,
    paidCents: paid.reduce((s, p) => s + p.amountCents, 0),
    currency: "MZN",
    recent: payments.slice(0, 10),
    syncedAt: new Date().toISOString(),
  };

  return upsertProjection(
    RELIABILITY_RULES.projections.names.buyerBillingSummary,
    buyerId,
    data,
  );
}

export async function projectOpsPulse() {
  const [ordersPending, paymentsProcessing, inboxDead, outboxDead] =
    await Promise.all([
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.billingPayment.count({ where: { status: "PROCESSING" } }),
      prisma.inboxMessage.count({ where: { status: "DEAD" } }),
      prisma.outboxMessage.count({ where: { status: "DEAD" } }),
    ]);

  const data = {
    ordersPending,
    paymentsProcessing,
    inboxDead,
    outboxDead,
    healthy: inboxDead === 0 && outboxDead === 0,
    syncedAt: new Date().toISOString(),
  };

  return upsertProjection(
    RELIABILITY_RULES.projections.names.platformOpsPulse,
    "global",
    data,
  );
}

/* ── Inbox / outbox stats ──────────────────────────────────────── */

export async function inboxStats() {
  const [received, processing, processed, failed, dead] = await Promise.all([
    prisma.inboxMessage.count({ where: { status: InboxStatus.RECEIVED } }),
    prisma.inboxMessage.count({ where: { status: InboxStatus.PROCESSING } }),
    prisma.inboxMessage.count({ where: { status: InboxStatus.PROCESSED } }),
    prisma.inboxMessage.count({ where: { status: InboxStatus.FAILED } }),
    prisma.inboxMessage.count({ where: { status: InboxStatus.DEAD } }),
  ]);
  return { received, processing, processed, failed, dead };
}

export async function outboxStats() {
  const [pending, publishing, published, failed, dead] = await Promise.all([
    prisma.outboxMessage.count({ where: { status: OutboxStatus.PENDING } }),
    prisma.outboxMessage.count({ where: { status: OutboxStatus.PUBLISHING } }),
    prisma.outboxMessage.count({ where: { status: OutboxStatus.PUBLISHED } }),
    prisma.outboxMessage.count({ where: { status: OutboxStatus.FAILED } }),
    prisma.outboxMessage.count({ where: { status: OutboxStatus.DEAD } }),
  ]);
  return { pending, publishing, published, failed, dead };
}

export async function reliabilityHealth() {
  const [inbox, outbox, ops] = await Promise.all([
    inboxStats(),
    outboxStats(),
    getProjection(
      RELIABILITY_RULES.projections.names.platformOpsPulse,
      "global",
    ),
  ]);
  return {
    ok: inbox.dead === 0 && outbox.dead === 0,
    rules: {
      inboxMaxAttempts: RELIABILITY_RULES.inbox.maxAttempts,
      outboxPollMs: RELIABILITY_RULES.outbox.pollIntervalMs,
      idempotencyHeader: RELIABILITY_RULES.idempotency.header,
    },
    inbox,
    outbox,
    opsProjection: ops,
  };
}

/* ── Outbox dispatcher ─────────────────────────────────────────── */

async function claimOutboxBatch(limit = RELIABILITY_RULES.outbox.batchSize) {
  const now = new Date();
  const leaseCutoff = new Date(
    now.getTime() - RELIABILITY_RULES.outbox.publishingLeaseMs,
  );

  const candidates = await prisma.outboxMessage.findMany({
    where: {
      OR: [
        { status: OutboxStatus.PENDING, availableAt: { lte: now } },
        { status: OutboxStatus.FAILED, availableAt: { lte: now } },
        { status: OutboxStatus.PUBLISHING, updatedAt: { lte: leaseCutoff } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const claimed = [];
  for (const row of candidates) {
    const updated = await prisma.outboxMessage.updateMany({
      where: {
        id: row.id,
        status: row.status,
        updatedAt: row.updatedAt,
      },
      data: { status: OutboxStatus.PUBLISHING },
    });
    if (updated.count === 1) {
      claimed.push(
        await prisma.outboxMessage.findUniqueOrThrow({ where: { id: row.id } }),
      );
    }
  }
  return claimed;
}

async function markOutboxPublished(id: string) {
  return prisma.outboxMessage.update({
    where: { id },
    data: {
      status: OutboxStatus.PUBLISHED,
      publishedAt: new Date(),
      lastError: null,
    },
  });
}

async function markOutboxFailed(id: string, error: string) {
  const current = await prisma.outboxMessage.findUniqueOrThrow({
    where: { id },
  });
  const attempts = current.attempts + 1;
  const dead = attempts >= current.maxAttempts;
  return prisma.outboxMessage.update({
    where: { id },
    data: {
      attempts,
      lastError: error.slice(0, 1000),
      status: dead ? OutboxStatus.DEAD : OutboxStatus.FAILED,
      availableAt: dead
        ? current.availableAt
        : new Date(Date.now() + outboxBackoffMs(attempts)),
    },
  });
}

async function createNotification(data: {
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

/** Nest DevelopersService.deliverEvent parity — merchant webhook fan-out. */
async function deliverEvent(
  eventType: string,
  payload: Record<string, unknown>,
) {
  const shopId =
    typeof payload.sellerShopId === "string"
      ? payload.sellerShopId
      : typeof payload.shopId === "string"
        ? payload.shopId
        : null;

  let tenantId =
    typeof payload.tenantId === "string" ? payload.tenantId : null;

  if (!tenantId && shopId) {
    const tenant = await prisma.tenant.findUnique({ where: { shopId } });
    tenantId = tenant?.id ?? null;
  }

  if (!tenantId) return;

  const endpoints = await prisma.merchantWebhookEndpoint.findMany({
    where: { tenantId, isActive: true },
  });

  for (const endpoint of endpoints) {
    if (endpoint.events.length > 0 && !endpoint.events.includes(eventType)) {
      continue;
    }

    const body = JSON.stringify({
      id: randomBytes(8).toString("hex"),
      type: eventType,
      createdAt: new Date().toISOString(),
      data: payload,
    });
    const signature = createHmac("sha256", endpoint.secret)
      .update(body)
      .digest("hex");

    const delivery = await prisma.merchantWebhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        eventType,
        payload: JSON.parse(body) as object,
        status: "PENDING",
        attempts: 1,
      },
    });

    try {
      const res = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-iShopine-Signature": signature,
          "X-iShopine-Event": eventType,
        },
        body,
        signal: AbortSignal.timeout(8000),
      });
      await prisma.merchantWebhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: res.ok ? "SUCCESS" : "FAILED",
          responseCode: res.status,
          lastError: res.ok ? null : `HTTP ${res.status}`,
        },
      });
    } catch (error) {
      await prisma.merchantWebhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "FAILED",
          lastError:
            error instanceof Error ? error.message : "webhook delivery failed",
        },
      });
    }
  }
}

async function dispatchOutbox(
  eventType: string,
  payload: Record<string, unknown>,
) {
  switch (eventType) {
    case "billing.payment.paid": {
      const buyerId = String(payload.buyerId || "");
      if (buyerId) {
        await projectBuyerBilling(buyerId);
        await createNotification({
          userId: buyerId,
          type: NotificationType.ORDER,
          title: "Pagamento confirmado",
          body: "O seu pagamento iShopine foi confirmado.",
          href: "/conta",
          metadata: {
            paymentId: payload.paymentId,
            reference: payload.reference,
          },
        });
      }
      await projectOpsPulse();
      await deliverEvent(eventType, payload);
      return;
    }
    case "billing.payment.failed": {
      const buyerId = String(payload.buyerId || "");
      if (buyerId) {
        await projectBuyerBilling(buyerId);
      }
      await projectOpsPulse();
      await deliverEvent(eventType, payload);
      return;
    }
    case "security.sync.completed": {
      await upsertProjection(
        RELIABILITY_RULES.projections.names.platformSecuritySync,
        "global",
        payload,
      );
      return;
    }
    case "commerce.checkout.completed":
    case "order.created":
    case "order.confirmed": {
      await projectOpsPulse();
      await deliverEvent(eventType, payload);
      return;
    }
    case "shipping.quote.requested":
    case "shipping.label.created":
    case "shipping.status.updated": {
      await projectOpsPulse();
      await deliverEvent(eventType, payload);
      return;
    }
    case "affiliate.reward.approved":
    case "affiliate.reward.paid": {
      await projectOpsPulse();
      return;
    }
    case "ops.pulse.refresh": {
      await projectOpsPulse();
      return;
    }
    default: {
      console.debug(`[platform-ops] No handler for outbox event ${eventType}`);
      await deliverEvent(eventType, payload);
    }
  }
}

let tickRunning = false;

/** Nest OutboxDispatcher.tick parity. */
export async function outboxTick() {
  if (tickRunning) return;
  tickRunning = true;
  try {
    const batch = await claimOutboxBatch();
    for (const msg of batch) {
      try {
        await dispatchOutbox(
          msg.eventType,
          msg.payload as Record<string, unknown>,
        );
        await markOutboxPublished(msg.id);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "outbox dispatch failed";
        console.warn(`[platform-ops] Outbox ${msg.id} failed: ${message}`);
        await markOutboxFailed(msg.id, message);
      }
    }
  } finally {
    tickRunning = false;
  }
}

export async function reliabilitySync() {
  await outboxTick();
  await projectOpsPulse();
  return reliabilityHealth();
}

export async function cronOutbox() {
  await outboxTick();
  await projectOpsPulse();
  return { ok: true, at: new Date().toISOString() };
}
