import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { AffiliateService } from './affiliate.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TwoFactorGuard } from '../common/guards/two-factor.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Controller('affiliate')
export class AffiliateController {
  constructor(private readonly affiliate: AffiliateService) {}

  @UseGuards(JwtAuthGuard)
  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.affiliate.summary(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('links')
  links(@CurrentUser() user: AuthUser) {
    return this.affiliate.listMine(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('rewards')
  rewards(@CurrentUser() user: AuthUser) {
    return this.affiliate.listRewards(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('links')
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: { productId?: string; shopId?: string; label?: string },
  ) {
    return this.affiliate.createLink(user.id, body);
  }

  @Post('click/:code')
  click(@Param('code') code: string) {
    return this.affiliate.trackClick(code);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, TwoFactorGuard)
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_OPERATOR)
  @Patch('rewards/:id/approve')
  approveReward(@Param('id') id: string) {
    return this.affiliate.approveReward(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, TwoFactorGuard)
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_OPERATOR)
  @Patch('rewards/:id/pay')
  payReward(@Param('id') id: string, @Body() body: { note?: string }) {
    return this.affiliate.markRewardPaid(id, body.note);
  }
}
