import { Injectable, Logger } from '@nestjs/common';
import { InboxStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RELIABILITY_RULES, inboxBackoffMs } from './rules';

export type InboxReceiveInput = {
  source: string;
  messageKey: string;
  eventType: string;
  payload: unknown;
  headers?: Record<string, unknown>;
};

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Rigid idempotent receive: unique (source, messageKey).
   * Returns { duplicate: true } if already processed or already stored.
   */
  async receive(input: InboxReceiveInput) {
    const existing = await this.prisma.inboxMessage.findUnique({
      where: {
        source_messageKey: {
          source: input.source,
          messageKey: input.messageKey,
        },
      },
    });

    if (existing) {
      return {
        message: existing,
        duplicate: true,
        alreadyProcessed: existing.status === InboxStatus.PROCESSED,
      };
    }

    try {
      const message = await this.prisma.inboxMessage.create({
        data: {
          source: input.source,
          messageKey: input.messageKey,
          eventType: input.eventType,
          payload: input.payload as Prisma.InputJsonValue,
          headers: (input.headers ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
          status: InboxStatus.RECEIVED,
          maxAttempts: RELIABILITY_RULES.inbox.maxAttempts,
        },
      });
      return { message, duplicate: false, alreadyProcessed: false };
    } catch (error) {
      // Race on unique constraint → treat as duplicate
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const message = await this.prisma.inboxMessage.findUniqueOrThrow({
          where: {
            source_messageKey: {
              source: input.source,
              messageKey: input.messageKey,
            },
          },
        });
        return {
          message,
          duplicate: true,
          alreadyProcessed: message.status === InboxStatus.PROCESSED,
        };
      }
      throw error;
    }
  }

  async markProcessed(id: string) {
    return this.prisma.inboxMessage.update({
      where: { id },
      data: {
        status: InboxStatus.PROCESSED,
        processedAt: new Date(),
        lastError: null,
      },
    });
  }

  async markFailed(id: string, error: string) {
    const current = await this.prisma.inboxMessage.findUniqueOrThrow({
      where: { id },
    });
    const attempts = current.attempts + 1;
    const dead = attempts >= current.maxAttempts;
    return this.prisma.inboxMessage.update({
      where: { id },
      data: {
        attempts,
        lastError: error.slice(0, 1000),
        status: dead ? InboxStatus.DEAD : InboxStatus.FAILED,
        nextAttemptAt: dead
          ? null
          : new Date(Date.now() + inboxBackoffMs(attempts)),
      },
    });
  }

  /** Claim next failed/received messages for retry (low-latency reclaim) */
  async claimBatch(limit = 20) {
    const now = new Date();
    const leaseCutoff = new Date(
      now.getTime() - RELIABILITY_RULES.inbox.processingLeaseMs,
    );

    const candidates = await this.prisma.inboxMessage.findMany({
      where: {
        OR: [
          { status: InboxStatus.RECEIVED },
          {
            status: InboxStatus.FAILED,
            nextAttemptAt: { lte: now },
          },
          {
            status: InboxStatus.PROCESSING,
            updatedAt: { lte: leaseCutoff },
          },
        ],
      },
      orderBy: { receivedAt: 'asc' },
      take: limit,
    });

    const claimed = [];
    for (const row of candidates) {
      const updated = await this.prisma.inboxMessage.updateMany({
        where: {
          id: row.id,
          status: { in: [row.status] },
          updatedAt: row.updatedAt,
        },
        data: { status: InboxStatus.PROCESSING },
      });
      if (updated.count === 1) {
        claimed.push(
          await this.prisma.inboxMessage.findUniqueOrThrow({
            where: { id: row.id },
          }),
        );
      }
    }
    return claimed;
  }

  async stats() {
    const [received, processing, processed, failed, dead] = await Promise.all([
      this.prisma.inboxMessage.count({
        where: { status: InboxStatus.RECEIVED },
      }),
      this.prisma.inboxMessage.count({
        where: { status: InboxStatus.PROCESSING },
      }),
      this.prisma.inboxMessage.count({
        where: { status: InboxStatus.PROCESSED },
      }),
      this.prisma.inboxMessage.count({ where: { status: InboxStatus.FAILED } }),
      this.prisma.inboxMessage.count({ where: { status: InboxStatus.DEAD } }),
    ]);
    return { received, processing, processed, failed, dead };
  }
}
