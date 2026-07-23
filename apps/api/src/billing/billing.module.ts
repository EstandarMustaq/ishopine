import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { ReliabilityModule } from '../reliability/reliability.module';
import { BillingService } from './billing.service';

/**
 * Nest billing remnant (Phase 37). HTTP → billing/payments stranglers.
 * BillingService kept for Nest CommerceService fallthrough.
 */
@Module({
  imports: [OrdersModule, ReliabilityModule],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
