import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiKeyGuard, CurrentApiKey, type ApiKeyContext } from './api-key.guard';
import { DevelopersService } from './developers.service';

/** Public Commerce API for merchants (API key auth). */
@Controller('v1')
@UseGuards(ApiKeyGuard)
export class DevelopersPublicController {
  constructor(private readonly developers: DevelopersService) {}

  @Get('me')
  me(@CurrentApiKey() ctx: ApiKeyContext) {
    return {
      tenantId: ctx.tenantId,
      shopId: ctx.shopId,
      apiKeyId: ctx.apiKeyId,
    };
  }

  @Get('products')
  products(@CurrentApiKey() ctx: ApiKeyContext) {
    return this.developers.listProducts(ctx.tenantId, ctx.shopId);
  }

  @Get('orders')
  orders(@CurrentApiKey() ctx: ApiKeyContext) {
    return this.developers.listOrders(ctx.tenantId, ctx.shopId);
  }
}
