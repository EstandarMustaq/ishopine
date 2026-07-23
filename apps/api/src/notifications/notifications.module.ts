import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

/**
 * Phase 34: Nest notifications HTTP → comms strangler.
 * Keep NotificationsService for OutboxDispatcher DI.
 */
@Module({
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
