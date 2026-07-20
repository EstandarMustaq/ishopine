import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AffiliateService } from './affiliate.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
}
