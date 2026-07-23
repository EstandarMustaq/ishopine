import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';

/**
 * Nest pricing remnant (Phase 37). HTTP → billing strangler (:4104).
 * PricingService kept for Nest SubscriptionsService.
 */
@Module({
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
