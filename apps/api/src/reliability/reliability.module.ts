import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsModule } from '../notifications/notifications.module';
import { InboxService } from './inbox.service';
import { OutboxService } from './outbox.service';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { ProjectionService } from './projection.service';
import { OutboxDispatcher } from './outbox.dispatcher';
import { ReliabilityController } from './reliability.controller';

const isServerless = Boolean(process.env.VERCEL);

@Module({
  imports: [
    ...(isServerless ? [] : [ScheduleModule.forRoot()]),
    NotificationsModule,
  ],
  controllers: [ReliabilityController],
  providers: [
    InboxService,
    OutboxService,
    IdempotencyService,
    ProjectionService,
    OutboxDispatcher,
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
  exports: [
    InboxService,
    OutboxService,
    IdempotencyService,
    ProjectionService,
    OutboxDispatcher,
  ],
})
export class ReliabilityModule {}
