import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DisputeStatus, PlatformRole } from '@prisma/client';
import { DisputesService } from './disputes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: { orderId: string; reason: string; description: string },
  ) {
    return this.disputes.create(user.id, body);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.disputes.listForUser(user.id, user.platformRole as PlatformRole);
  }

  @UseGuards(RolesGuard)
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_OPERATOR)
  @Patch(':id/resolve')
  resolve(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { status: DisputeStatus; resolution: string },
  ) {
    return this.disputes.resolve(
      id,
      body.status,
      body.resolution,
      user.platformRole as PlatformRole,
    );
  }
}
