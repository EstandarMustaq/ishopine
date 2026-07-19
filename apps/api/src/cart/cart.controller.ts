import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  getCart(@CurrentUser() user: AuthUser) {
    return this.cart.getCart(user.id);
  }

  @Post('items')
  addItem(
    @CurrentUser() user: AuthUser,
    @Body() body: { productId: string; quantity?: number },
  ) {
    return this.cart.addItem(user.id, body.productId, body.quantity ?? 1);
  }

  @Patch('items/:productId')
  updateItem(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Body() body: { quantity: number },
  ) {
    return this.cart.updateItem(user.id, productId, body.quantity);
  }

  @Delete('items/:productId')
  removeItem(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
  ) {
    return this.cart.removeItem(user.id, productId);
  }

  @Delete()
  clear(@CurrentUser() user: AuthUser) {
    return this.cart.clear(user.id);
  }
}
