import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { ApiKeyGuard } from './api-key.guard';
import { DevelopersPublicController } from './developers-public.controller';
import { DevelopersController } from './developers.controller';
import { DevelopersService } from './developers.service';

@Module({
  imports: [AccountsModule, FeatureFlagsModule],
  controllers: [DevelopersController, DevelopersPublicController],
  providers: [DevelopersService, ApiKeyGuard],
  exports: [DevelopersService],
})
export class DevelopersModule {}
