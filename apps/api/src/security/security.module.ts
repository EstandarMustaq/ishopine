import { Module, OnModuleInit } from '@nestjs/common';
import { ReliabilityModule } from '../reliability/reliability.module';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';

@Module({
  imports: [ReliabilityModule],
  controllers: [SecurityController],
  providers: [SecurityService],
  exports: [SecurityService],
})
export class SecurityModule implements OnModuleInit {
  constructor(private readonly security: SecurityService) {}

  async onModuleInit() {
    // Boot-time security sync (non-blocking failures)
    try {
      await this.security.syncSystem();
    } catch {
      // DB may not be ready during generate-only builds
    }
  }
}
