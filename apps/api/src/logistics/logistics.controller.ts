import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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

  /** Stub label download (JSON placeholder). */
  @Get('shipments/:id/label')
  async labelStub(@Param('id') id: string) {
    const shipment = await this.logistics.getShipment(id);
    return {
      format: 'stub',
      shipmentId: id,
      trackingCode: shipment?.trackingCode,
      carrierCode: shipment?.carrierCode,
      message: 'Etiqueta simulada — integração real na Fase 8+',
    };
  }
}
