import { Controller, Get, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Nest billing HTTP remnant (Phase 32).
 * PaySuite + stripe/mpesa → services/payments.
 * Prefer strangler BILLING_URL for list + PAYMENTS_URL for PaySuite.
 */
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @UseGuards(JwtAuthGuard)
  @Get('payments')
  listPayments(@CurrentUser() user: AuthUser) {
    return this.billing.listPayments(user.id);
  }
}
