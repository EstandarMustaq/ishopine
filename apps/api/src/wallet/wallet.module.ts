import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';

/**
 * Nest wallet remnant (Phase 37). HTTP → wallet strangler (:4103).
 * WalletService kept for Nest OrdersService settle fallback.
 */
@Module({
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
