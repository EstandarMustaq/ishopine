import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { ShopsController } from './shops.controller';
import { ShopsService } from './shops.service';

@Module({
  imports: [AccountsModule],
  controllers: [ShopsController],
  providers: [ShopsService],
  exports: [ShopsService],
})
export class ShopsModule {}
