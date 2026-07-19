import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TwoFactorGuard } from '../common/guards/two-factor.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @UseGuards(JwtAuthGuard, RolesGuard, TwoFactorGuard)
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_OPERATOR)
  @Get('dashboard/overview')
  overview() {
    return this.dashboard.overview();
  }

  @Get(['store/settings', 'platform/settings'])
  settings() {
    return this.dashboard.platformSettings();
  }

  @UseGuards(JwtAuthGuard, RolesGuard, TwoFactorGuard)
  @Roles(PlatformRole.PLATFORM_ADMIN)
  @Patch(['store/settings', 'platform/settings'])
  updateSettings(
    @Body()
    body: {
      marketplaceName?: string;
      tagline?: string;
      shippingFlatCents?: number;
      freeShippingCents?: number;
      requireSeller2fa?: boolean;
      requireEmailVerify?: boolean;
      commissionBps?: number;
      currency?: string;
      supportEmail?: string;
      supportPhone?: string;
      logoUrl?: string;
    },
  ) {
    return this.dashboard.updatePlatformSettings(body);
  }
}
