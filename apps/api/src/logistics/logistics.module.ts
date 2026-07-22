import { Module } from '@nestjs/common';
import { ReliabilityModule } from '../reliability/reliability.module';
import { AccountsModule } from '../accounts/accounts.module';
import { LogisticsController } from './logistics.controller';
import { LogisticsService } from './logistics.service';

@Module({
  imports: [ReliabilityModule, AccountsModule],
  controllers: [LogisticsController],
  providers: [LogisticsService],
  exports: [LogisticsService],
})
export class LogisticsModule {}
