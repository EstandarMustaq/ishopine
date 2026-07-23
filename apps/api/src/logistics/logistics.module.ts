import { Module } from '@nestjs/common';
import { ReliabilityModule } from '../reliability/reliability.module';
import { LogisticsService } from './logistics.service';

/**
 * Nest logistics remnant (Phase 38). HTTP → logistics strangler (:4112).
 * LogisticsService kept for Nest OrdersService quote/label fallthrough.
 * Correios HTTP still blocked (no OpenAPI under docs/contracts/).
 */
@Module({
  imports: [ReliabilityModule],
  providers: [LogisticsService],
  exports: [LogisticsService],
})
export class LogisticsModule {}
