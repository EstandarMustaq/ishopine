import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { OrdersModule } from '../orders/orders.module';
import { ReliabilityModule } from '../reliability/reliability.module';
import { CommerceController } from './commerce.controller';
import { CommerceService } from './commerce.service';

@Module({
  imports: [OrdersModule, BillingModule, ReliabilityModule],
  controllers: [CommerceController],
  providers: [CommerceService],
  exports: [CommerceService],
})
export class CommerceModule {}
