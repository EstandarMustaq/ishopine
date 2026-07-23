import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { LogisticsModule } from '../logistics/logistics.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { WalletModule } from '../wallet/wallet.module';
import { OrdersService } from './orders.service';

/**
 * Nest orders remnant (Phase 39). HTTP → orders strangler (:4101).
 * OrdersService.settlePaidOrders kept for Nest BillingService / commerce
 * fallthrough.
 */
@Module({
  imports: [
    AccountsModule,
    AffiliateModule,
    WalletModule,
    SubscriptionsModule,
    LogisticsModule,
  ],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
