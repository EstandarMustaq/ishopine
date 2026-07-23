import { Module, OnModuleInit } from '@nestjs/common';
import { ReliabilityModule } from '../reliability/reliability.module';
import { SecurityService } from './security.service';

/**
 * Nest security module (Phase 33). HTTP → platform-security.
 * Keep SecurityService + boot sync for Nest fallthrough ops.
 */
@Module({
  imports: [ReliabilityModule],
  providers: [SecurityService],
  exports: [SecurityService],
})
export class SecurityModule implements OnModuleInit {
  constructor(private readonly security: SecurityService) {}

  async onModuleInit() {
    try {
      await this.security.syncSystem();
    } catch {
      // best-effort
    }
  }
}
