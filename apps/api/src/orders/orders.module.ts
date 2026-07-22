import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { LogisticsModule } from '../logistics/logistics.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { WalletModule } from '../wallet/wallet.module';
import { OrdersController } from './orders.controller';
import { OrdersInternalController } from './orders-internal.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    AccountsModule,
    AffiliateModule,
    WalletModule,
    SubscriptionsModule,
    LogisticsModule,
  ],
  controllers: [OrdersController, OrdersInternalController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
