import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { MpesaClient } from './mpesa.client';
import { StripeService } from './stripe.service';

@Module({
  imports: [OrdersModule],
  controllers: [BillingController],
  providers: [BillingService, StripeService, MpesaClient],
  exports: [BillingService],
})
export class BillingModule {}
