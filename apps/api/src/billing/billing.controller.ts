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
import { PlatformRole } from '@prisma/client';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TwoFactorGuard } from '../common/guards/two-factor.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  CreatePayoutDto,
  CreateRefundDto,
  PaysuiteCheckoutDto,
} from './dto/billing.dto';
import type { PaysuitePaymentMethod } from './paysuite';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @UseGuards(JwtAuthGuard)
  @Post('paysuite/checkout')
  paysuiteCheckout(
    @CurrentUser() user: AuthUser,
    @Body() body: PaysuiteCheckoutDto,
  ) {
    return this.billing.createPaysuiteCheckout(
      user.id,
      body.orderIds,
      body.method as PaysuitePaymentMethod,
      body.msisdn,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('paysuite/status/:paymentId')
  paysuiteStatus(
    @CurrentUser() user: AuthUser,
    @Param('paymentId') paymentId: string,
  ) {
    return this.billing.syncPaysuiteStatus(user.id, paymentId);
  }

  @Post('paysuite/webhook')
  paysuiteWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-webhook-signature') signature: string | undefined,
    @Headers('x-account-id') accountId: string | undefined,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Raw body em falta para webhook PaySuite');
    }
    return this.billing.handlePaysuiteWebhook(rawBody, signature, accountId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('payments')
  listPayments(@CurrentUser() user: AuthUser) {
    return this.billing.listPayments(user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, TwoFactorGuard)
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_OPERATOR)
  @Post('paysuite/payouts')
  createPayout(@CurrentUser() user: AuthUser, @Body() body: CreatePayoutDto) {
    return this.billing.createSellerPayout(
      { id: user.id, platformRole: user.platformRole },
      {
        reference: body.reference,
        amountCents: Number(body.amountCents),
        method: body.method,
        phone: body.phone,
        holder: body.holder,
        description: body.description,
      },
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard, TwoFactorGuard)
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_OPERATOR)
  @Post('paysuite/refunds')
  createRefund(@CurrentUser() user: AuthUser, @Body() body: CreateRefundDto) {
    return this.billing.createRefund(
      { id: user.id, platformRole: user.platformRole },
      {
        paymentId: body.paymentId,
        amountCents: Number(body.amountCents),
        reason: body.reason,
      },
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('stripe/checkout')
  legacyStripe(
    @CurrentUser() user: AuthUser,
    @Body() body: { orderIds: string[] },
  ) {
    return this.billing.createPaysuiteCheckout(
      user.id,
      body.orderIds,
      'credit_card',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('mpesa/c2b')
  legacyMpesa(
    @CurrentUser() user: AuthUser,
    @Body() body: { orderIds: string[]; msisdn?: string },
  ) {
    return this.billing.createPaysuiteCheckout(
      user.id,
      body.orderIds,
      'mpesa',
      body.msisdn,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('mpesa/status/:paymentId')
  legacyMpesaStatus(
    @CurrentUser() user: AuthUser,
    @Param('paymentId') paymentId: string,
  ) {
    return this.billing.syncPaysuiteStatus(user.id, paymentId);
  }
}
