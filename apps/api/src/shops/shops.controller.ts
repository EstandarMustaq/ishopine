import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ShopStatus, ShopType, TenantType } from '@prisma/client';
import { ShopsService } from './shops.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  RequireTenantTypes,
  TenantGuard,
} from '../accounts/tenant.guard';

@Controller('shops')
export class ShopsController {
  constructor(private readonly shops: ShopsService) {}

  @Get()
  listPublic(
    @Query()
    query: { q?: string; type?: string; province?: string; page?: string; limit?: string },
  ) {
    return this.shops.listPublic(query);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequireTenantTypes(TenantType.PARTICULAR, TenantType.STORE)
  @Get('mine')
  myShops(@CurrentUser() user: AuthUser) {
    return this.shops.myShops(user.id);
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.shops.getBySlug(slug);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      name: string;
      description?: string;
      shopType?: ShopType;
      province: string;
      district: string;
      latitude: number;
      longitude: number;
      logoUrl?: string;
      bannerUrl?: string;
    },
  ) {
    return this.shops.createShop(user.id, body);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequireTenantTypes(TenantType.STORE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body()
    body: Partial<{
      name: string;
      description: string;
      logoUrl: string;
      bannerUrl: string;
      policiesText: string;
      hoursJson: Record<string, string>;
      shopType: ShopType;
      province: string;
      district: string;
      latitude: number;
      longitude: number;
      status: ShopStatus;
    }>,
  ) {
    return this.shops.updateShop(id, user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/follow')
  follow(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.shops.follow(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/follow')
  unfollow(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.shops.unfollow(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/following')
  following(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.shops.isFollowing(user.id, id);
  }
}
