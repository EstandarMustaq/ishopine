import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  MpesaC2bDto,
  MpesaCallbackDto,
  StripeCheckoutDto,
} from './dto/billing.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @UseGuards(JwtAuthGuard)
  @Post('stripe/checkout')
  stripeCheckout(
    @CurrentUser() user: AuthUser,
    @Body() body: StripeCheckoutDto,
  ) {
    return this.billing.createStripeCheckout(user.id, body.orderIds);
  }

  @Post('stripe/webhook')
  stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Raw body em falta para webhook Stripe');
    }
    return this.billing.handleStripeWebhook(rawBody, signature);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mpesa/c2b')
  mpesaC2b(@CurrentUser() user: AuthUser, @Body() body: MpesaC2bDto) {
    return this.billing.initiateMpesaC2b(user.id, body.orderIds, body.msisdn);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mpesa/status/:paymentId')
  mpesaStatus(
    @CurrentUser() user: AuthUser,
    @Param('paymentId') paymentId: string,
  ) {
    return this.billing.getMpesaStatus(user.id, paymentId);
  }

  @Post('mpesa/callback')
  mpesaCallback(@Body() body: MpesaCallbackDto) {
    return this.billing.handleMpesaCallback(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('payments')
  listPayments(@CurrentUser() user: AuthUser) {
    return this.billing.listPayments(user.id);
  }
}
