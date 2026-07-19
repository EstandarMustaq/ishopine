import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { InventoryMovementType, Role } from '@prisma/client';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OPERATOR)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('movements')
  list(@Query('productId') productId?: string) {
    return this.inventory.listMovements(productId);
  }

  @Get('low-stock')
  lowStock(@Query('threshold') threshold?: string) {
    return this.inventory.lowStock(threshold ? Number(threshold) : 5);
  }

  @Post(':productId/adjust')
  adjust(
    @Param('productId') productId: string,
    @Body()
    body: {
      type: InventoryMovementType;
      quantity: number;
      reason: string;
    },
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventory.adjust(productId, {
      ...body,
      operatorId: user.id,
    });
  }
}
