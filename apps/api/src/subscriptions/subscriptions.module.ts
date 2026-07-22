import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { PricingModule } from '../pricing/pricing.module';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [AccountsModule, PricingModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
