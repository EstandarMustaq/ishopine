import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import type { PaysuitePaymentMethod } from '../billing/paysuite';
import { CommerceService } from './commerce.service';

@Controller('commerce')
@UseGuards(JwtAuthGuard)
export class CommerceController {
  constructor(private readonly commerce: CommerceService) {}

  /**
   * Single-command checkout saga (orders → PaySuite).
   * Also exposed by services/commerce-orchestrator via composition.
   */
  @Post('checkout')
  checkout(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      addressId?: string;
      paymentMethod?: PaymentMethod;
      notes?: string;
      couponCode?: string;
      affiliateCode?: string;
      paysuiteMethod: PaysuitePaymentMethod;
      msisdn?: string;
    },
  ) {
    return this.commerce.checkout(user.id, body);
  }
}
