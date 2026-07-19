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
import { OrderStatus, PaymentMethod, Role } from '@prisma/client';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
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
    },
  ) {
    return this.orders.checkout(user.id, body);
  }

  @Get('mine')
  myOrders(@CurrentUser() user: AuthUser) {
    return this.orders.listForUser(user.id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.OPERATOR)
  @Get()
  listAll(
    @Query() query: { status?: OrderStatus; page?: string; limit?: string },
  ) {
    return this.orders.listAll(query);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.getOne(id, { id: user.id, role: user.role as Role });
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.OPERATOR)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: OrderStatus },
    @CurrentUser() user: AuthUser,
  ) {
    return this.orders.updateStatus(id, body.status, user.id);
  }
}
