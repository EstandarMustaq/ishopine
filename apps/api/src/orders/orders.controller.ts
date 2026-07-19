import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrderStatus, PaymentMethod, PlatformRole } from '@prisma/client';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TwoFactorGuard } from '../common/guards/two-factor.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('checkout')
  checkout(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      addressId?: string;
      paymentMethod?: PaymentMethod;
      notes?: string;
      couponCode?: string;
    },
  ) {
    return this.orders.checkout(user.id, body);
  }

  @Get('mine')
  myOrders(@CurrentUser() user: AuthUser) {
    return this.orders.listForUser(user.id);
  }

  @UseGuards(TwoFactorGuard)
  @Get('selling')
  sellerOrders(@CurrentUser() user: AuthUser) {
    return this.orders.listForSeller(user.id);
  }

  @UseGuards(RolesGuard, TwoFactorGuard)
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_OPERATOR)
  @Get()
  listAll(
    @Query() query: { status?: OrderStatus; page?: string; limit?: string },
  ) {
    return this.orders.listAll(query);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.getOne(id, {
      id: user.id,
      platformRole: user.platformRole,
    });
  }

  @UseGuards(RolesGuard, TwoFactorGuard)
  @Roles(
    PlatformRole.PLATFORM_ADMIN,
    PlatformRole.PLATFORM_OPERATOR,
    PlatformRole.SELLER,
  )
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: OrderStatus },
    @CurrentUser() user: AuthUser,
  ) {
    return this.orders.updateStatus(id, body.status, user.id);
  }
}
