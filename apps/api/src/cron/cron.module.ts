import { Module } from '@nestjs/common';
import { ReliabilityModule } from '../reliability/reliability.module';
import { CronController } from './cron.controller';

@Module({
  imports: [ReliabilityModule],
  controllers: [CronController],
})
export class CronModule {}
