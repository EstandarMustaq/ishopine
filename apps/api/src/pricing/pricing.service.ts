import { Injectable, OnModuleInit } from '@nestjs/common';
import { PricingPlanCode, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_PLANS: Array<{
  code: PricingPlanCode;
  name: string;
  description: string;
  monthlyPriceCents: number;
  includedOrders: number | null;
  overageOrderCents: number;
  commissionBps: number | null;
  sortOrder: number;
  features: Prisma.InputJsonValue;
}> = [
  {
    code: PricingPlanCode.FREE,
    name: 'Free',
    description: 'Começar a vender no iShopine',
    monthlyPriceCents: 0,
    includedOrders: 20,
    overageOrderCents: 500,
    commissionBps: 800,
    sortOrder: 0,
    features: { storeCategories: false, ads: false },
  },
  {
    code: PricingPlanCode.STARTER,
    name: 'Starter',
    description: 'Para particulares e micro-lojas',
    monthlyPriceCents: 49900,
    includedOrders: 100,
    overageOrderCents: 300,
    commissionBps: 600,
    sortOrder: 1,
    features: { storeCategories: true, ads: false },
  },
  {
    code: PricingPlanCode.BUSINESS,
    name: 'Business',
    description: 'Para lojas em crescimento',
    monthlyPriceCents: 149900,
    includedOrders: 500,
    overageOrderCents: 150,
    commissionBps: 500,
    sortOrder: 2,
    features: { storeCategories: true, ads: true },
  },
  {
    code: PricingPlanCode.ENTERPRISE,
    name: 'Enterprise',
    description: 'Volume alto e suporte dedicado',
    monthlyPriceCents: 0,
    includedOrders: null,
    overageOrderCents: 0,
    commissionBps: 350,
    sortOrder: 3,
    features: { storeCategories: true, ads: true, sla: true },
  },
];

@Injectable()
export class PricingService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureDefaultPlans();
  }

  async ensureDefaultPlans() {
    for (const plan of DEFAULT_PLANS) {
      await this.prisma.pricingPlan.upsert({
        where: { code: plan.code },
        create: {
          code: plan.code,
          name: plan.name,
          description: plan.description,
          monthlyPriceCents: plan.monthlyPriceCents,
          includedOrders: plan.includedOrders,
          overageOrderCents: plan.overageOrderCents,
          commissionBps: plan.commissionBps,
          sortOrder: plan.sortOrder,
          features: plan.features,
        },
        update: {
          name: plan.name,
          description: plan.description,
          monthlyPriceCents: plan.monthlyPriceCents,
          includedOrders: plan.includedOrders,
          overageOrderCents: plan.overageOrderCents,
          commissionBps: plan.commissionBps,
          sortOrder: plan.sortOrder,
          features: plan.features,
          isActive: true,
        },
      });
    }
  }

  listPlans() {
    return this.prisma.pricingPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  getByCode(code: PricingPlanCode) {
    return this.prisma.pricingPlan.findUnique({ where: { code } });
  }
}
