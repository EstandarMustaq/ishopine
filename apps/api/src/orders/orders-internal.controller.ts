import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from './orders.service';

/**
 * Internal settle after PaySuite PAID (payments strangler → Nest).
 * Auth: Bearer INTERNAL_SERVICE_SECRET | CRON_SECRET.
 */
@Controller('orders/internal')
export class OrdersInternalController {
  constructor(
    private readonly orders: OrdersService,
    private readonly config: ConfigService,
  ) {}

  @Post('settle-paid')
  async settlePaid(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { orderIds?: string[] },
  ) {
    const secret =
      this.config.get<string>('INTERNAL_SERVICE_SECRET') ||
      this.config.get<string>('CRON_SECRET');
    if (!secret) {
      throw new UnauthorizedException('Internal secret not configured');
    }
    const expected = `Bearer ${secret}`;
    if (authorization !== expected) {
      throw new UnauthorizedException('Invalid internal secret');
    }
    if (!Array.isArray(body.orderIds) || body.orderIds.length === 0) {
      return { ok: false, message: 'orderIds obrigatório' };
    }
    await this.orders.settlePaidOrders(body.orderIds);
    return { ok: true, settled: body.orderIds.length };
  }
}
