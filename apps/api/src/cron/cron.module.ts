import { Module } from '@nestjs/common';
import { ReliabilityModule } from '../reliability/reliability.module';
import { CronController } from './cron.controller';

/**
 * Phase 33: thin Vercel cron bridge → PLATFORM_OPS_URL or Nest dispatcher.
 * Ownership of cron remains platform-ops when STRANGLER_ROUTING is on.
 */
@Module({
  imports: [ReliabilityModule],
  controllers: [CronController],
})
export class CronModule {}
