import { Module } from '@nestjs/common';
import { AffiliateService } from './affiliate.service';

/**
 * Nest affiliate remnant (Phase 36). HTTP → affiliates strangler (:4108).
 * AffiliateService kept for Nest OrdersService settle fallback.
 */
@Module({
  providers: [AffiliateService],
  exports: [AffiliateService],
})
export class AffiliateModule {}
