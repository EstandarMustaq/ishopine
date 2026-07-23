import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccountsModule } from './accounts/accounts.module';
import { AffiliateModule } from './affiliate/affiliate.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { CartModule } from './cart/cart.module';
import { CommerceModule } from './commerce/commerce.module';
import { CronModule } from './cron/cron.module';
import { PricingModule } from './pricing/pricing.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { WalletModule } from './wallet/wallet.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { DevelopersModule } from './developers/developers.module';
import { LogisticsModule } from './logistics/logistics.module';
import { MailModule } from './mail/mail.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReliabilityModule } from './reliability/reliability.module';
import { SecurityModule } from './security/security.module';

/**
 * Nest monolith remnant. Media/developers/logistics HTTP retired (Phase 38)
 * — owned by stranglers. DevelopersService kept for OutboxDispatcher;
 * LogisticsService for Orders fallthrough. UploadsModule removed (media owned).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    ReliabilityModule,
    CronModule,
    SecurityModule,
    MailModule,
    AuthModule,
    AccountsModule,
    CartModule,
    OrdersModule,
    BillingModule,
    AffiliateModule,
    NotificationsModule,
    CommerceModule,
    WalletModule,
    PricingModule,
    SubscriptionsModule,
    FeatureFlagsModule,
    DevelopersModule,
    LogisticsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
