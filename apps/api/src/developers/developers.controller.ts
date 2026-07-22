import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TenantType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import {
  CurrentTenant,
  type RequestTenant,
} from '../accounts/current-tenant.decorator';
import {
  RequireTenantTypes,
  TenantGuard,
} from '../accounts/tenant.guard';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { DevelopersService } from './developers.service';

@Controller('developers')
@UseGuards(JwtAuthGuard, TenantGuard)
@RequireTenantTypes(TenantType.STORE)
export class DevelopersController {
  constructor(
    private readonly developers: DevelopersService,
    private readonly flags: FeatureFlagsService,
  ) {}

  @Get('status')
  async status(@CurrentTenant() tenant: RequestTenant) {
    const flag = await this.flags.evaluate({
      key: 'developer_platform',
      tenantId: tenant.tenantId,
    });
    return {
      enabled: flag.enabled,
      source: flag.source,
      tenantId: tenant.tenantId,
    };
  }

  @Get('keys')
  listKeys(@CurrentTenant() tenant: RequestTenant) {
    return this.developers.listApiKeys(tenant.tenantId);
  }

  @Post('keys')
  createKey(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenant: RequestTenant,
    @Body() body: { name?: string },
  ) {
    return this.developers.createApiKey(
      user.id,
      tenant.tenantId,
      body.name || 'Default',
    );
  }

  @Delete('keys/:id')
  revokeKey(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenant: RequestTenant,
    @Param('id') id: string,
  ) {
    return this.developers.revokeApiKey(user.id, tenant.tenantId, id);
  }

  @Get('webhooks')
  listWebhooks(@CurrentTenant() tenant: RequestTenant) {
    return this.developers.listWebhooks(tenant.tenantId);
  }

  @Post('webhooks')
  upsertWebhook(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenant: RequestTenant,
    @Body() body: { url: string; events?: string[] },
  ) {
    return this.developers.upsertWebhook(user.id, tenant.tenantId, body);
  }

  @Post('webhooks/:id/rotate')
  rotateSecret(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenant: RequestTenant,
    @Param('id') id: string,
  ) {
    return this.developers.rotateWebhookSecret(user.id, tenant.tenantId, id);
  }
}
