import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';

/**
 * Phase 40+: Vercel cron bridge → PLATFORM_OPS_URL only (required).
 */
@Module({
  controllers: [CronController],
})
export class CronModule {}
