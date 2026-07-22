import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PricingPlanCode,
  SubscriptionStatus,
  UsageMetric,
} from '@prisma/client';
import { AccountsService } from '../accounts/accounts.service';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';

function periodKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function addMonths(d: Date, months: number) {
  const next = new Date(d);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccountsService,
    private readonly pricing: PricingService,
  ) {}

  async getActiveForTenant(tenantId: string) {
    return this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async ensureFreeSubscription(tenantId: string, accountId: string) {
    const existing = await this.getActiveForTenant(tenantId);
    if (existing) return existing;

    const free = await this.pricing.getByCode(PricingPlanCode.FREE);
    if (!free) throw new NotFoundException('Plano FREE em falta');

    const start = new Date();
    return this.prisma.subscription.create({
      data: {
        planId: free.id,
        tenantId,
        accountId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: start,
        currentPeriodEnd: addMonths(start, 1),
      },
      include: { plan: true },
    });
  }

  /** Lazy FREE plan for tenants that never subscribed explicitly. */
  async ensureActiveOrFree(tenantId: string) {
    const active = await this.getActiveForTenant(tenantId);
    if (active) return active;
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    return this.ensureFreeSubscription(tenantId, tenant.ownerAccountId);
  }

  async subscribeTenant(
    userId: string,
    tenantId: string,
    planCode: PricingPlanCode,
  ) {
    const account = await this.accounts.ensureAccountForUser(userId);
    await this.accounts.resolveTenantAccess(account.id, tenantId);

    const plan = await this.pricing.getByCode(planCode);
    if (!plan?.isActive) throw new NotFoundException('Plano inválido');

    const active = await this.getActiveForTenant(tenantId);
    if (active) {
      await this.prisma.subscription.update({
        where: { id: active.id },
        data: { status: SubscriptionStatus.CANCELLED, cancelAtPeriodEnd: true },
      });
    }

    const start = new Date();
    return this.prisma.subscription.create({
      data: {
        planId: plan.id,
        tenantId,
        accountId: account.id,
        status:
          plan.monthlyPriceCents === 0
            ? SubscriptionStatus.ACTIVE
            : SubscriptionStatus.TRIALING,
        currentPeriodStart: start,
        currentPeriodEnd: addMonths(start, 1),
      },
      include: { plan: true },
    });
  }

  async recordUsage(input: {
    tenantId: string;
    metric: UsageMetric;
    quantity?: number;
    reference?: string;
  }) {
    // Idempotent settle: one usage row per order reference + metric.
    if (input.reference) {
      const existing = await this.prisma.usageRecord.findFirst({
        where: {
          tenantId: input.tenantId,
          metric: input.metric,
          reference: input.reference,
        },
      });
      if (existing) return existing;
    }

    return this.prisma.usageRecord.create({
      data: {
        tenantId: input.tenantId,
        metric: input.metric,
        quantity: input.quantity ?? 1,
        periodKey: periodKey(),
        reference: input.reference,
      },
    });
  }

  async usageSummary(tenantId: string, period?: string) {
    const key = period || periodKey();
    const rows = await this.prisma.usageRecord.groupBy({
      by: ['metric'],
      where: { tenantId, periodKey: key },
      _sum: { quantity: true },
    });
    const sub = await this.ensureActiveOrFree(tenantId);
    return {
      periodKey: key,
      subscription: sub,
      usage: rows.map((r) => ({
        metric: r.metric,
        quantity: r._sum.quantity ?? 0,
      })),
    };
  }

  /**
   * Build a DRAFT platform invoice for the tenant period (subscription + overage).
   */
  async generateInvoice(tenantId: string, period?: string) {
    const key = period || periodKey();
    const sub = await this.getActiveForTenant(tenantId);
    if (!sub) {
      throw new BadRequestException('Tenant sem subscrição activa');
    }

    const existing = await this.prisma.platformInvoice.findFirst({
      where: { tenantId, periodKey: key, status: { not: 'VOID' } },
    });
    if (existing) return existing;

    const ordersUsed = await this.prisma.usageRecord.aggregate({
      where: {
        tenantId,
        periodKey: key,
        metric: UsageMetric.ORDERS,
      },
      _sum: { quantity: true },
    });
    const orderCount = ordersUsed._sum.quantity ?? 0;
    const included = sub.plan.includedOrders;
    const overage =
      included == null ? 0 : Math.max(0, orderCount - included);
    const overageCents = overage * (sub.plan.overageOrderCents ?? 0);
    const subscriptionCents = sub.plan.monthlyPriceCents;
    const subtotalCents = subscriptionCents + overageCents;

    const lineItems = [
      {
        type: 'subscription',
        plan: sub.plan.code,
        amountCents: subscriptionCents,
      },
      ...(overage > 0
        ? [
            {
              type: 'overage_orders',
              quantity: overage,
              unitCents: sub.plan.overageOrderCents,
              amountCents: overageCents,
            },
          ]
        : []),
    ];

    return this.prisma.platformInvoice.create({
      data: {
        tenantId,
        accountId: sub.accountId,
        periodKey: key,
        status: 'DRAFT',
        subtotalCents,
        totalCents: subtotalCents,
        lineItems,
        dueAt: addMonths(new Date(), 0),
      },
    });
  }

  listInvoices(tenantId: string) {
    return this.prisma.platformInvoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 24,
    });
  }
}
