import { Module } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';

/**
 * Nest feature-flags remnant (Phase 38). HTTP → developers strangler (:4106).
 * FeatureFlagsService kept for Nest boot seed (OnModuleInit).
 */
@Module({
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
