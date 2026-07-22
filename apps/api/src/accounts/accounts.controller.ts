import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { AccountsService } from './accounts.service';
import { TENANT_HEADER } from './tenant.constants';

@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const account = await this.accounts.ensureAccountForUser(user.id);
    const tenants = await this.accounts.listTenants(account.id);
    return {
      account: {
        id: account.id,
        email: account.email,
        name: account.name,
        phone: account.phone,
      },
      tenants,
      platformStaffRole: account.platformStaff?.role ?? null,
    };
  }

  @Post('tenants/particular')
  async createParticular(
    @CurrentUser() user: AuthUser,
    @Body() body: { name?: string },
  ) {
    const account = await this.accounts.ensureAccountForUser(user.id);
    const tenant = await this.accounts.createParticularTenant(
      account.id,
      body.name,
    );
    return { tenant };
  }

  @Post('tenants/store')
  async createStore(
    @CurrentUser() user: AuthUser,
    @Body() body: { name: string; shopId?: string },
  ) {
    const account = await this.accounts.ensureAccountForUser(user.id);
    const tenant = await this.accounts.createStoreTenant(account.id, body);
    return { tenant };
  }

  @Get('tenants/active')
  async activeTenant(
    @CurrentUser() user: AuthUser,
    @Headers(TENANT_HEADER) tenantId?: string,
  ) {
    if (!tenantId) {
      return { tenant: null };
    }
    const account = await this.accounts.ensureAccountForUser(user.id);
    const tenant = await this.accounts.resolveTenantAccess(
      account.id,
      tenantId,
    );
    return { tenant };
  }
}
