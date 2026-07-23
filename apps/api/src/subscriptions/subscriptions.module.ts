import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { PricingModule } from '../pricing/pricing.module';
import { SubscriptionsService } from './subscriptions.service';

/**
 * Nest subscriptions remnant (Phase 37). HTTP → billing strangler (:4104).
 * SubscriptionsService kept for Nest OrdersService usage settle fallback.
 */
@Module({
  imports: [AccountsModule, PricingModule],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
