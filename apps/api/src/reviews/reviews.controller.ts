import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('products/:id/reviews')
  list(@Param('id') id: string) {
    return this.reviews.listForProduct(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('products/:id/reviews')
  create(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { rating: number; title?: string; comment?: string },
  ) {
    return this.reviews.create(user.id, id, body);
  }
}
