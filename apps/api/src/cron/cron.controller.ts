import {
  Controller,
  Get,
  Headers,
  HttpException,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Phase 40+: Vercel cron entry only. Always proxies to platform-ops.
 * Nest reliability/outbox engine removed — no nest-inline fallback.
 */
@Controller('cron')
export class CronController {
  constructor(private readonly config: ConfigService) {}

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
    if (!opsUrl) {
      throw new ServiceUnavailableException(
        'PLATFORM_OPS_URL required (Nest outbox engine retired in Phase 40+)',
      );
    }

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
}
