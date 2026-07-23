import {
  Controller,
  Get,
  Headers,
  HttpException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxDispatcher } from '../reliability/outbox.dispatcher';
import { ProjectionService } from '../reliability/projection.service';

/**
 * Phase 33: Nest cron HTTP ownership is platform-ops, but Vercel still hits
 * apps/api `/api/cron/outbox`. Prefer proxy to PLATFORM_OPS_URL; otherwise
 * run in-process dispatcher (reliability engine stays in Nest).
 */
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
    if (authorization !== `Bearer ${secret}`) {
      throw new UnauthorizedException('Invalid cron secret');
    }

    const opsUrl = this.config.get<string>('PLATFORM_OPS_URL')?.replace(
      /\/$/,
      '',
    );
    if (opsUrl) {
      const res = await fetch(`${opsUrl}/api/cron/outbox`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}` },
      });
      const text = await res.text();
      let body: unknown = { ok: res.ok };
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = { ok: res.ok, message: text.slice(0, 300) };
        }
      }
      if (!res.ok) {
        const message =
          typeof body === 'object' &&
          body &&
          'message' in body &&
          typeof (body as { message: unknown }).message === 'string'
            ? (body as { message: string }).message
            : `platform-ops cron failed (${res.status})`;
        throw new HttpException(message, res.status);
      }
      return body;
    }

    await this.dispatcher.tick();
    await this.projections.projectOpsPulse();
    return { ok: true, at: new Date().toISOString(), mode: 'nest-inline' };
  }
}
