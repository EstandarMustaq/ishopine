import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TwoFactorGuard } from '../common/guards/two-factor.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { InboxService } from './inbox.service';
import { OutboxService } from './outbox.service';
import { ProjectionService } from './projection.service';
import { OutboxDispatcher } from './outbox.dispatcher';
import { RELIABILITY_RULES } from './rules';

@Controller('reliability')
@UseGuards(JwtAuthGuard, RolesGuard, TwoFactorGuard)
@Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_OPERATOR)
export class ReliabilityController {
  constructor(
    private readonly inbox: InboxService,
    private readonly outbox: OutboxService,
    private readonly projections: ProjectionService,
    private readonly dispatcher: OutboxDispatcher,
  ) {}

  @Get('health')
  async health() {
    const [inbox, outbox, ops] = await Promise.all([
      this.inbox.stats(),
      this.outbox.stats(),
      this.projections.get(
        RELIABILITY_RULES.projections.names.platformOpsPulse,
        'global',
      ),
    ]);
    return {
      ok: inbox.dead === 0 && outbox.dead === 0,
      rules: {
        inboxMaxAttempts: RELIABILITY_RULES.inbox.maxAttempts,
        outboxPollMs: RELIABILITY_RULES.outbox.pollIntervalMs,
        idempotencyHeader: RELIABILITY_RULES.idempotency.header,
      },
      inbox,
      outbox,
      opsProjection: ops,
    };
  }

  @Post('sync')
  async sync() {
    await this.dispatcher.tick();
    await this.projections.projectOpsPulse();
    return this.health();
  }
}
