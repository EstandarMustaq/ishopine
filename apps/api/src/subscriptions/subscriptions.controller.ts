import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { PricingPlanCode, TenantType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import {
  CurrentTenant,
  type RequestTenant,
} from '../accounts/current-tenant.decorator';
import {
  RequireTenantTypes,
  TenantGuard,
} from '../accounts/tenant.guard';
import { SubscriptionsService } from './subscriptions.service';

@Controller()
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequireTenantTypes(TenantType.PARTICULAR, TenantType.STORE)
  @Get('subscriptions/me')
  async me(@CurrentTenant() tenant: RequestTenant | null) {
    if (!tenant) return { subscription: null };
    const subscription = await this.subscriptions.ensureActiveOrFree(
      tenant.tenantId,
    );
    return { subscription };
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequireTenantTypes(TenantType.PARTICULAR, TenantType.STORE)
  @Post('subscriptions')
  subscribe(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenant: RequestTenant,
    @Body() body: { planCode: PricingPlanCode },
  ) {
    return this.subscriptions.subscribeTenant(
      user.id,
      tenant.tenantId,
      body.planCode,
    );
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequireTenantTypes(TenantType.PARTICULAR, TenantType.STORE)
  @Get('billing/usage')
  usage(
    @CurrentTenant() tenant: RequestTenant,
    @Query('period') period?: string,
  ) {
    return this.subscriptions.usageSummary(tenant.tenantId, period);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequireTenantTypes(TenantType.PARTICULAR, TenantType.STORE)
  @Post('billing/invoices/generate')
  generateInvoice(
    @CurrentTenant() tenant: RequestTenant,
    @Body() body: { period?: string },
  ) {
    return this.subscriptions.generateInvoice(tenant.tenantId, body.period);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequireTenantTypes(TenantType.PARTICULAR, TenantType.STORE)
  @Get('billing/invoices')
  invoices(@CurrentTenant() tenant: RequestTenant) {
    return this.subscriptions.listInvoices(tenant.tenantId);
  }
}
