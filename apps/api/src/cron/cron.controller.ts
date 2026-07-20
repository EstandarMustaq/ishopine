import {
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxDispatcher } from '../reliability/outbox.dispatcher';
import { ProjectionService } from '../reliability/projection.service';

@Controller('cron')
export class CronController {
  constructor(
    private readonly config: ConfigService,
    private readonly dispatcher: OutboxDispatcher,
    private readonly projections: ProjectionService,
  ) {}

  @Get('outbox')
  @Post('outbox')
  async outbox(@Headers('authorization') authorization?: string) {
    const secret = this.config.get<string>('CRON_SECRET');
    if (!secret) {
      throw new UnauthorizedException('CRON_SECRET not configured');
    }
    const expected = `Bearer ${secret}`;
    if (authorization !== expected) {
      throw new UnauthorizedException('Invalid cron secret');
    }
    await this.dispatcher.tick();
    await this.projections.projectOpsPulse();
    return { ok: true, at: new Date().toISOString() };
  }
}
