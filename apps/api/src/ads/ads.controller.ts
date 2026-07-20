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
import { AdSlot, AdStatus, PlatformRole } from '@prisma/client';
import { AdsService } from './ads.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TwoFactorGuard } from '../common/guards/two-factor.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('ads')
export class AdsController {
  constructor(private readonly ads: AdsService) {}

  @Get()
  listPublic(@Query('slot') slot?: AdSlot) {
    return this.ads.listPublic(slot);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, TwoFactorGuard)
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_OPERATOR)
  @Get('admin')
  listAdmin() {
    return this.ads.listAdmin();
  }

  @UseGuards(JwtAuthGuard, RolesGuard, TwoFactorGuard)
  @Roles(PlatformRole.PLATFORM_ADMIN)
  @Post()
  create(
    @Body()
    body: {
      title: string;
      subtitle?: string;
      imageUrl: string;
      linkUrl: string;
      slot?: AdSlot;
      status?: AdStatus;
      priority?: number;
      startsAt?: string;
      endsAt?: string;
      shopId?: string;
    },
  ) {
    return this.ads.create(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, TwoFactorGuard)
  @Roles(PlatformRole.PLATFORM_ADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      subtitle?: string | null;
      imageUrl?: string;
      linkUrl?: string;
      slot?: AdSlot;
      status?: AdStatus;
      priority?: number;
      startsAt?: string | null;
      endsAt?: string | null;
      shopId?: string | null;
    },
  ) {
    return this.ads.update(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, TwoFactorGuard)
  @Roles(PlatformRole.PLATFORM_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ads.remove(id);
  }
}
