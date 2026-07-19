import { Injectable, Logger } from '@nestjs/common';
import { OutboxStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RELIABILITY_RULES, outboxBackoffMs } from './rules';

export type OutboxEnqueueInput = {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  headers?: Record<string, unknown>;
  availableAt?: Date;
};

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Enqueue within an optional transaction client */
  async enqueue(
    input: OutboxEnqueueInput,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    return tx.outboxMessage.create({
      data: {
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payload: input.payload as Prisma.InputJsonValue,
        headers: (input.headers ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        status: OutboxStatus.PENDING,
        maxAttempts: RELIABILITY_RULES.outbox.maxAttempts,
        availableAt: input.availableAt ?? new Date(),
      },
    });
  }

  async claimBatch(limit = RELIABILITY_RULES.outbox.batchSize) {
    const now = new Date();
    const leaseCutoff = new Date(
      now.getTime() - RELIABILITY_RULES.outbox.publishingLeaseMs,
    );

    const candidates = await this.prisma.outboxMessage.findMany({
      where: {
        OR: [
          {
            status: OutboxStatus.PENDING,
            availableAt: { lte: now },
          },
          {
            status: OutboxStatus.FAILED,
            availableAt: { lte: now },
          },
          {
            status: OutboxStatus.PUBLISHING,
            updatedAt: { lte: leaseCutoff },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    const claimed = [];
    for (const row of candidates) {
      const updated = await this.prisma.outboxMessage.updateMany({
        where: {
          id: row.id,
          status: row.status,
          updatedAt: row.updatedAt,
        },
        data: { status: OutboxStatus.PUBLISHING },
      });
      if (updated.count === 1) {
        claimed.push(
          await this.prisma.outboxMessage.findUniqueOrThrow({
            where: { id: row.id },
          }),
        );
      }
    }
    return claimed;
  }

  async markPublished(id: string) {
    return this.prisma.outboxMessage.update({
      where: { id },
      data: {
        status: OutboxStatus.PUBLISHED,
        publishedAt: new Date(),
        lastError: null,
      },
    });
  }

  async markFailed(id: string, error: string) {
    const current = await this.prisma.outboxMessage.findUniqueOrThrow({
      where: { id },
    });
    const attempts = current.attempts + 1;
    const dead = attempts >= current.maxAttempts;
    return this.prisma.outboxMessage.update({
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

  async stats() {
    const [pending, publishing, published, failed, dead] = await Promise.all([
      this.prisma.outboxMessage.count({
        where: { status: OutboxStatus.PENDING },
      }),
      this.prisma.outboxMessage.count({
        where: { status: OutboxStatus.PUBLISHING },
      }),
      this.prisma.outboxMessage.count({
        where: { status: OutboxStatus.PUBLISHED },
      }),
      this.prisma.outboxMessage.count({
        where: { status: OutboxStatus.FAILED },
      }),
      this.prisma.outboxMessage.count({ where: { status: OutboxStatus.DEAD } }),
    ]);
    return { pending, publishing, published, failed, dead };
  }
}
