import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { OutboxService } from './outbox.service';
import { ProjectionService } from './projection.service';
import { RELIABILITY_RULES } from './rules';
import { NotificationsService } from '../notifications/notifications.service';
import { DevelopersService } from '../developers/developers.service';

@Injectable()
export class OutboxDispatcher {
  private readonly logger = new Logger(OutboxDispatcher.name);
  private running = false;

  constructor(
    private readonly outbox: OutboxService,
    private readonly projections: ProjectionService,
    private readonly notifications: NotificationsService,
    private readonly developers: DevelopersService,
  ) {}

  @Interval(RELIABILITY_RULES.outbox.pollIntervalMs)
  async scheduledTick() {
    if (process.env.VERCEL) return;
    return this.tick();
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const batch = await this.outbox.claimBatch();
      for (const msg of batch) {
        try {
          await this.dispatch(
            msg.eventType,
            msg.payload as Record<string, unknown>,
          );
          await this.outbox.markPublished(msg.id);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'outbox dispatch failed';
          this.logger.warn(`Outbox ${msg.id} failed: ${message}`);
          await this.outbox.markFailed(msg.id, message);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async dispatch(eventType: string, payload: Record<string, unknown>) {
    switch (eventType) {
      case 'billing.payment.paid': {
        const buyerId = String(payload.buyerId || '');
        if (buyerId) {
          await this.projections.projectBuyerBilling(buyerId);
          await this.notifications.create({
            userId: buyerId,
            type: 'ORDER',
            title: 'Pagamento confirmado',
            body: 'O seu pagamento iShopine foi confirmado.',
            href: '/conta',
            metadata: {
              paymentId: payload.paymentId,
              reference: payload.reference,
            },
          });
        }
        await this.projections.projectOpsPulse();
        await this.developers.deliverEvent(eventType, payload);
        return;
      }
      case 'billing.payment.failed': {
        const buyerId = String(payload.buyerId || '');
        if (buyerId) {
          await this.projections.projectBuyerBilling(buyerId);
        }
        await this.projections.projectOpsPulse();
        await this.developers.deliverEvent(eventType, payload);
        return;
      }
      case 'security.sync.completed': {
        await this.projections.upsert(
          RELIABILITY_RULES.projections.names.platformSecuritySync,
          'global',
          payload,
        );
        return;
      }
      case 'commerce.checkout.completed':
      case 'order.created':
      case 'order.confirmed': {
        await this.projections.projectOpsPulse();
        await this.developers.deliverEvent(eventType, payload);
        return;
      }
      case 'shipping.quote.requested':
      case 'shipping.label.created':
      case 'shipping.status.updated': {
        await this.projections.projectOpsPulse();
        await this.developers.deliverEvent(eventType, payload);
        return;
      }
      case 'affiliate.reward.approved':
      case 'affiliate.reward.paid': {
        await this.projections.projectOpsPulse();
        return;
      }
      case 'ops.pulse.refresh': {
        await this.projections.projectOpsPulse();
        return;
      }
      default: {
        this.logger.debug(`No handler for outbox event ${eventType}`);
        await this.developers.deliverEvent(eventType, payload);
      }
    }
  }
}
