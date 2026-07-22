import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AccountsModule, AffiliateModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
