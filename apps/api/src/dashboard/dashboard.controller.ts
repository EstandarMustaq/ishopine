import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.OPERATOR)
  @Get('dashboard/overview')
  overview() {
    return this.dashboard.overview();
  }

  @Get('store/settings')
  settings() {
    return this.dashboard.storeSettings();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('store/settings')
  updateSettings(
    @Body()
    body: {
      storeName?: string;
      tagline?: string;
      supportEmail?: string;
      supportPhone?: string;
      shippingFlatCents?: number;
      freeShippingCents?: number;
      logoUrl?: string;
    },
  ) {
    return this.dashboard.updateStoreSettings(body);
  }
}
