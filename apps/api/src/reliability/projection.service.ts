import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RELIABILITY_RULES } from './rules';

@Injectable()
export class ProjectionService {
  constructor(private readonly prisma: PrismaService) {}

  private checksum(data: unknown): string {
    return createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 32);
  }

  async upsert(name: string, partitionKey: string, data: unknown, bumpVersion = true) {
    const checksum = this.checksum(data);
    const existing = await this.prisma.readProjection.findUnique({
      where: { name_partitionKey: { name, partitionKey } },
    });

    if (existing?.checksum === checksum) {
      return { projection: existing, changed: false };
    }

    const projection = await this.prisma.readProjection.upsert({
      where: { name_partitionKey: { name, partitionKey } },
      create: {
        name,
        partitionKey,
        data: data as Prisma.InputJsonValue,
        checksum,
        version: 1,
        projectedAt: new Date(),
      },
      update: {
        data: data as Prisma.InputJsonValue,
        checksum,
        version: bumpVersion ? { increment: 1 } : undefined,
        projectedAt: new Date(),
      },
    });
    return { projection, changed: true };
  }

  async get<T = unknown>(name: string, partitionKey: string): Promise<T | null> {
    const row = await this.prisma.readProjection.findUnique({
      where: { name_partitionKey: { name, partitionKey } },
    });
    return (row?.data as T) ?? null;
  }

  async projectBuyerBilling(buyerId: string) {
    const payments = await this.prisma.billingPayment.findMany({
      where: { buyerId },
      orderBy: { createdAt: 'desc' },
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

    const paid = payments.filter((p) => p.status === 'PAID');
    const data = {
      buyerId,
      paymentCount: payments.length,
      paidCount: paid.length,
      paidCents: paid.reduce((s, p) => s + p.amountCents, 0),
      currency: 'MZN',
      recent: payments.slice(0, 10),
      syncedAt: new Date().toISOString(),
    };

    return this.upsert(
      RELIABILITY_RULES.projections.names.buyerBillingSummary,
      buyerId,
      data,
    );
  }

  async projectOpsPulse() {
    const [ordersPending, paymentsProcessing, inboxDead, outboxDead] =
      await Promise.all([
        this.prisma.order.count({ where: { status: 'PENDING' } }),
        this.prisma.billingPayment.count({
          where: { status: 'PROCESSING' },
        }),
        this.prisma.inboxMessage.count({ where: { status: 'DEAD' } }),
        this.prisma.outboxMessage.count({ where: { status: 'DEAD' } }),
      ]);

    const data = {
      ordersPending,
      paymentsProcessing,
      inboxDead,
      outboxDead,
      healthy: inboxDead === 0 && outboxDead === 0,
      syncedAt: new Date().toISOString(),
    };

    return this.upsert(
      RELIABILITY_RULES.projections.names.platformOpsPulse,
      'global',
      data,
    );
  }
}
