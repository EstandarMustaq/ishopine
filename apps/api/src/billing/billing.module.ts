import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { ReliabilityModule } from '../reliability/reliability.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [OrdersModule, ReliabilityModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
