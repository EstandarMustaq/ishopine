import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { DevelopersService } from './developers.service';

/**
 * Nest developers remnant (Phase 38). HTTP → developers strangler (:4106).
 * DevelopersService kept for OutboxDispatcher webhook delivery.
 */
@Module({
  imports: [AccountsModule],
  providers: [DevelopersService],
  exports: [DevelopersService],
})
export class DevelopersModule {}
