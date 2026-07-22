import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PricingPlanCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_FLAGS: Array<{ key: string; description: string; enabled: boolean }> = [
  {
    key: 'developer_platform',
    description: 'API keys e webhooks para merchants',
    enabled: true,
  },
  {
    key: 'store_hours_policies',
    description: 'Horários e políticas na ficha da loja',
    enabled: true,
  },
  {
    key: 'media_tenant_scope',
    description: 'Uploads scoped por tenant',
    enabled: true,
  },
];

@Injectable()
export class FeatureFlagsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    for (const flag of DEFAULT_FLAGS) {
      await this.prisma.featureFlag.upsert({
        where: { key: flag.key },
        create: flag,
        update: { description: flag.description },
      });
    }
  }

  list() {
    return this.prisma.featureFlag.findMany({
      include: { overrides: true },
      orderBy: { key: 'asc' },
    });
  }

  async setEnabled(key: string, enabled: boolean) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) throw new NotFoundException('Flag não encontrada');
    return this.prisma.featureFlag.update({
      where: { id: flag.id },
      data: { enabled },
    });
  }

  async setOverride(input: {
    key: string;
    scopeKey: string;
    enabled: boolean;
    tenantId?: string | null;
  }) {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { key: input.key },
    });
    if (!flag) throw new NotFoundException('Flag não encontrada');

    return this.prisma.featureFlagOverride.upsert({
      where: {
        flagId_scopeKey: { flagId: flag.id, scopeKey: input.scopeKey },
      },
      create: {
        flagId: flag.id,
        scopeKey: input.scopeKey,
        enabled: input.enabled,
        tenantId: input.tenantId ?? null,
      },
      update: {
        enabled: input.enabled,
        tenantId: input.tenantId ?? null,
      },
    });
  }

  /**
   * Resolve enabled state: plan override > tenant override > global flag.
   */
  async evaluate(input: {
    key: string;
    tenantId?: string | null;
    planCode?: PricingPlanCode | null;
  }) {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { key: input.key },
      include: { overrides: true },
    });
    if (!flag) {
      return { key: input.key, enabled: false, source: 'missing' as const };
    }

    if (input.planCode) {
      const planScope = `plan:${input.planCode}`;
      const planOverride = flag.overrides.find((o) => o.scopeKey === planScope);
      if (planOverride) {
        return {
          key: input.key,
          enabled: planOverride.enabled,
          source: 'plan' as const,
        };
      }
    }

    if (input.tenantId) {
      const tenantScope = `tenant:${input.tenantId}`;
      const tenantOverride = flag.overrides.find(
        (o) => o.scopeKey === tenantScope,
      );
      if (tenantOverride) {
        return {
          key: input.key,
          enabled: tenantOverride.enabled,
          source: 'tenant' as const,
        };
      }
    }

    return {
      key: input.key,
      enabled: flag.enabled,
      source: 'global' as const,
    };
  }

  async evaluateMany(
    keys: string[],
    ctx: { tenantId?: string | null; planCode?: PricingPlanCode | null },
  ) {
    const results = await Promise.all(
      keys.map((key) => this.evaluate({ key, ...ctx })),
    );
    return Object.fromEntries(results.map((r) => [r.key, r]));
  }
}
