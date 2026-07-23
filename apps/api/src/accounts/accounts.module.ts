import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { TenantGuard } from './tenant.guard';

/**
 * Nest accounts remnant (Phase 36). HTTP → accounts strangler (:4109).
 * AccountsService + TenantGuard kept for in-process Nest authz.
 */
@Module({
  providers: [AccountsService, TenantGuard],
  exports: [AccountsService, TenantGuard],
})
export class AccountsModule {}
