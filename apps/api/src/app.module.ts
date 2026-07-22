import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccountingModule } from './accounting/accounting.module';
import { AccountsModule } from './accounts/accounts.module';
import { AdsModule } from './ads/ads.module';
import { AffiliateModule } from './affiliate/affiliate.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { CartModule } from './cart/cart.module';
import { CatalogModule } from './catalog/catalog.module';
import { CouponsModule } from './coupons/coupons.module';
import { CommerceModule } from './commerce/commerce.module';
import { CronModule } from './cron/cron.module';
import { PricingModule } from './pricing/pricing.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { WalletModule } from './wallet/wallet.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { DevelopersModule } from './developers/developers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DisputesModule } from './disputes/disputes.module';
import { InventoryModule } from './inventory/inventory.module';
import { MailModule } from './mail/mail.module';
import { MessagesModule } from './messages/messages.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReliabilityModule } from './reliability/reliability.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SecurityModule } from './security/security.module';
import { ShopsModule } from './shops/shops.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';
import { WishlistModule } from './wishlist/wishlist.module';

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
    UsersModule,
    ShopsModule,
    CatalogModule,
    CartModule,
    OrdersModule,
    BillingModule,
    InventoryModule,
    AccountingModule,
    AffiliateModule,
    AdsModule,
    UploadsModule,
    DashboardModule,
    WishlistModule,
    ReviewsModule,
    NotificationsModule,
    MessagesModule,
    CouponsModule,
    DisputesModule,
    CommerceModule,
    WalletModule,
    PricingModule,
    SubscriptionsModule,
    FeatureFlagsModule,
    DevelopersModule,
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
