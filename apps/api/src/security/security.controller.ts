import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TwoFactorGuard } from '../common/guards/two-factor.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SecurityService } from './security.service';

@Controller('security')
@UseGuards(JwtAuthGuard, RolesGuard, TwoFactorGuard)
@Roles(PlatformRole.PLATFORM_ADMIN)
export class SecurityController {
  constructor(private readonly security: SecurityService) {}

  @Get('compliance')
  compliance() {
    return this.security.complianceSnapshot();
  }

  @Get('findings')
  findings() {
    return this.security.listFindings();
  }

  @Post('sync')
  sync() {
    return this.security.syncSystem();
  }

  @Post('findings/:id/acknowledge')
  acknowledge(@Param('id') id: string) {
    return this.security.acknowledge(id);
  }
}
