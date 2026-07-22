import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PlatformRole, TenantType } from '@prisma/client';
import { memoryStorage } from 'multer';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TwoFactorGuard } from '../common/guards/two-factor.guard';
import { Roles } from '../common/decorators/roles.decorator';
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
import { AccountsService } from '../accounts/accounts.service';

@UseGuards(JwtAuthGuard, RolesGuard, TwoFactorGuard)
@Roles(
  PlatformRole.PLATFORM_ADMIN,
  PlatformRole.PLATFORM_OPERATOR,
  PlatformRole.SELLER,
)
@Controller(['uploads', 'media'])
export class UploadsController {
  constructor(
    private readonly uploads: UploadsService,
    private readonly accounts: AccountsService,
  ) {}

  @Post()
  @UseGuards(TenantGuard)
  @RequireTenantTypes(TenantType.PARTICULAR, TenantType.STORE)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async upload(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenant: RequestTenant | null,
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder?: string,
    @Query('shopId') shopId?: string,
  ) {
    const account = await this.accounts.ensureAccountForUser(user.id);
    return this.uploads.upload(file, folder ?? 'products', {
      accountId: account.id,
      tenantId: tenant?.tenantId ?? null,
      shopId: shopId ?? tenant?.shopId ?? null,
      uploadedById: user.id,
    });
  }

  @Get()
  @UseGuards(TenantGuard)
  @RequireTenantTypes(TenantType.PARTICULAR, TenantType.STORE)
  async list(
    @CurrentTenant() tenant: RequestTenant | null,
    @Query('folder') folder?: string,
    @Query('shopId') shopId?: string,
  ) {
    return this.uploads.list({
      folder,
      tenantId: tenant?.tenantId,
      shopId: shopId ?? tenant?.shopId ?? undefined,
    });
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.uploads.remove(id, user.id);
  }
}
