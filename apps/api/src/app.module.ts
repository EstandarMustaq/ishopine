import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccountingModule } from './accounting/accounting.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { CartModule } from './cart/cart.module';
import { CatalogModule } from './catalog/catalog.module';
import { CouponsModule } from './coupons/coupons.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DisputesModule } from './disputes/disputes.module';
import { InventoryModule } from './inventory/inventory.module';
import { MailModule } from './mail/mail.module';
import { MessagesModule } from './messages/messages.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReviewsModule } from './reviews/reviews.module';
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
    MailModule,
    AuthModule,
    UsersModule,
    ShopsModule,
    CatalogModule,
    CartModule,
    OrdersModule,
    BillingModule,
    InventoryModule,
    AccountingModule,
    UploadsModule,
    DashboardModule,
    WishlistModule,
    ReviewsModule,
    NotificationsModule,
    MessagesModule,
    CouponsModule,
    DisputesModule,
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
