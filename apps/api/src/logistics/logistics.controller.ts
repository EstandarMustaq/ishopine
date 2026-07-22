import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { TenantType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentTenant,
  type RequestTenant,
} from '../accounts/current-tenant.decorator';
import {
  RequireTenantTypes,
  TenantGuard,
} from '../accounts/tenant.guard';
import { LogisticsService } from './logistics.service';
import { ShippingQuoteDto } from './dto/shipping-quote.dto';

@Controller('logistics')
export class LogisticsController {
  constructor(private readonly logistics: LogisticsService) {}

  @Get('carriers')
  carriers() {
    return this.logistics.listCarriers();
  }

  @Post('quote')
  quote(@Body() body: ShippingQuoteDto) {
    return this.logistics.quote(body);
  }

  /**
   * Carrier status webhooks (HMAC: x-carrier-signature = sha256=<hex>).
   * Secret: CARRIER_WEBHOOK_SECRET.
   */
  @Post('webhooks/:carrier')
  async carrierWebhook(
    @Param('carrier') carrier: string,
    @Body()
    body: {
      trackingCode?: string;
      shipmentId?: string;
      status?: string;
      note?: string;
    },
    @Req() req: Request & { rawBody?: Buffer | string },
    @Headers('x-carrier-signature') signature?: string,
  ) {
    const raw =
      typeof req.rawBody === 'string'
        ? req.rawBody
        : Buffer.isBuffer(req.rawBody)
          ? req.rawBody.toString('utf8')
          : JSON.stringify(body);
    return this.logistics.handleCarrierWebhook(
      carrier,
      body,
      raw,
      signature,
    );
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequireTenantTypes(TenantType.STORE)
  @Get('shipments')
  shipments(
    @CurrentTenant() tenant: RequestTenant,
    @Query('take') take?: string,
  ) {
    return this.logistics.listShipments({
      shopId: tenant.shopId ?? undefined,
      take: take ? Number(take) : 40,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('shipments/:id')
  async shipment(@Param('id') id: string) {
    return this.logistics.getShipment(id);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequireTenantTypes(TenantType.STORE)
  @Post('shipments/:orderId/label')
  createLabel(
    @Param('orderId') orderId: string,
    @Body() body: { trackingCode?: string },
  ) {
    return this.logistics.createLabel(orderId, body.trackingCode);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequireTenantTypes(TenantType.STORE)
  @Post('shipments/:id/transit')
  inTransit(@Param('id') id: string) {
    return this.logistics.markInTransit(id);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequireTenantTypes(TenantType.STORE)
  @Post('shipments/:id/delivered')
  delivered(@Param('id') id: string) {
    return this.logistics.markDelivered(id);
  }

  /** Printable HTML label (real, not stub). */
  @Get('shipments/:id/label')
  async labelHtml(@Param('id') id: string, @Res() res: Response) {
    const html = await this.logistics.renderLabelHtml(id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(html);
  }
}
