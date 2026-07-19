import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CouponType, PlatformRole } from '@prisma/client';
import { CouponsService } from './coupons.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_OPERATOR)
  @Get()
  list() {
    return this.coupons.list();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.PLATFORM_ADMIN)
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      code: string;
      type: CouponType;
      value: number;
      minSubtotalCents?: number;
      maxUses?: number;
      endsAt?: string;
    },
  ) {
    return this.coupons.create(user.id, body);
  }

  @Post('validate')
  validate(@Body() body: { code: string; subtotalCents: number }) {
    return this.coupons.validate(body.code, body.subtotalCents);
  }
}
