import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.wishlist.list(user.id);
  }

  @Post()
  add(@CurrentUser() user: AuthUser, @Body() body: { productId: string }) {
    return this.wishlist.add(user.id, body.productId);
  }

  @Delete(':productId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
  ) {
    return this.wishlist.remove(user.id, productId);
  }
}
