import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformRole, PricingPlanCode, TenantType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CurrentTenant,
  type RequestTenant,
} from '../accounts/current-tenant.decorator';
import {
  RequireTenantTypes,
  TenantGuard,
} from '../accounts/tenant.guard';
import { FeatureFlagsService } from './feature-flags.service';

@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly flags: FeatureFlagsService) {}

  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequireTenantTypes(TenantType.PARTICULAR, TenantType.STORE)
  @Get('evaluate')
  evaluate(
    @CurrentTenant() tenant: RequestTenant | null,
    @Query('keys') keys?: string,
    @Query('plan') plan?: string,
  ) {
    const list = (keys || 'developer_platform,store_hours_policies')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    const planCode =
      plan && Object.values(PricingPlanCode).includes(plan as PricingPlanCode)
        ? (plan as PricingPlanCode)
        : null;
    return this.flags.evaluateMany(list, {
      tenantId: tenant?.tenantId,
      planCode,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_OPERATOR)
  @Get()
  list() {
    return this.flags.list();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_OPERATOR)
  @Patch(':key')
  setEnabled(
    @Param('key') key: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.flags.setEnabled(key, Boolean(body.enabled));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_OPERATOR)
  @Post(':key/overrides')
  setOverride(
    @Param('key') key: string,
    @Body()
    body: { scopeKey: string; enabled: boolean; tenantId?: string },
  ) {
    return this.flags.setOverride({
      key,
      scopeKey: body.scopeKey,
      enabled: Boolean(body.enabled),
      tenantId: body.tenantId,
    });
  }
}
