import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { OrdersModule } from '../orders/orders.module';
import { ReliabilityModule } from '../reliability/reliability.module';
import { CommerceService } from './commerce.service';

/**
 * Nest commerce remnant (Phase 37). HTTP → orchestrator (:4100).
 * CommerceService kept for Nest in-process checkout fallthrough.
 */
@Module({
  imports: [OrdersModule, BillingModule, ReliabilityModule],
  providers: [CommerceService],
  exports: [CommerceService],
})
export class CommerceModule {}
