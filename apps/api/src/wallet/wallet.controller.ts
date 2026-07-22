import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
import { AccountsService } from '../accounts/accounts.service';
import { WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(
    private readonly wallets: WalletService,
    private readonly accounts: AccountsService,
  ) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const account = await this.accounts.ensureAccountForUser(user.id);
    const wallet = await this.wallets.getMineForAccount(account.id);
    const ledger = await this.wallets.listLedger(wallet.id, 30);
    return { wallet, ledger };
  }

  @UseGuards(TenantGuard)
  @RequireTenantTypes(TenantType.PARTICULAR, TenantType.STORE)
  @Get('tenant')
  async tenantWallet(@CurrentTenant() tenant: RequestTenant | null) {
    if (!tenant) {
      return { wallet: null, ledger: [] };
    }
    const wallet = await this.wallets.getMineForTenant(tenant.tenantId);
    const ledger = await this.wallets.listLedger(wallet.id, 30);
    return { wallet, ledger };
  }

  @Get('ledger')
  async ledger(
    @CurrentUser() user: AuthUser,
    @Query('take') take?: string,
  ) {
    const account = await this.accounts.ensureAccountForUser(user.id);
    const wallet = await this.wallets.getMineForAccount(account.id);
    return this.wallets.listLedger(wallet.id, take ? Number(take) : 50);
  }
}
