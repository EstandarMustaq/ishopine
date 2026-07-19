import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RELIABILITY_RULES } from './rules';

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  hashRequest(body: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(body ?? {}))
      .digest('hex');
  }

  async begin(scope: string, key: string, requestHash?: string) {
    const normalized = key.trim().slice(0, RELIABILITY_RULES.idempotency.keyMaxLength);
    if (!normalized) {
      return { kind: 'invalid' as const };
    }

    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: { scope_key: { scope, key: normalized } },
    });

    if (existing) {
      if (existing.expiresAt < new Date()) {
        await this.prisma.idempotencyRecord.delete({ where: { id: existing.id } });
      } else if (existing.status === 'COMPLETED') {
        return {
          kind: 'replay' as const,
          responseCode: existing.responseCode ?? 200,
          responseBody: existing.responseBody,
        };
      } else if (existing.status === 'STARTED') {
        return { kind: 'in_flight' as const };
      }
    }

    const expiresAt = new Date(
      Date.now() + RELIABILITY_RULES.idempotency.ttlHours * 3600_000,
    );

    try {
      const record = await this.prisma.idempotencyRecord.create({
        data: {
          scope,
          key: normalized,
          requestHash,
          status: 'STARTED',
          expiresAt,
        },
      });
      return { kind: 'started' as const, record };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { kind: 'in_flight' as const };
      }
      throw error;
    }
  }

  async complete(
    scope: string,
    key: string,
    responseCode: number,
    responseBody: unknown,
  ) {
    const normalized = key.trim().slice(0, RELIABILITY_RULES.idempotency.keyMaxLength);
    await this.prisma.idempotencyRecord.update({
      where: { scope_key: { scope, key: normalized } },
      data: {
        status: 'COMPLETED',
        responseCode,
        responseBody: responseBody as Prisma.InputJsonValue,
      },
    });
  }

  async fail(scope: string, key: string) {
    const normalized = key.trim().slice(0, RELIABILITY_RULES.idempotency.keyMaxLength);
    await this.prisma.idempotencyRecord.updateMany({
      where: { scope, key: normalized, status: 'STARTED' },
      data: { status: 'FAILED' },
    });
  }
}
