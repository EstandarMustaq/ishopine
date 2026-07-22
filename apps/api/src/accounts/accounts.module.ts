import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { TenantGuard } from './tenant.guard';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, TenantGuard],
  exports: [AccountsService, TenantGuard],
})
export class AccountsModule {}
