import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { randomBytes } from 'crypto';
import { BillingService } from '../billing/billing.service';
import type { PaysuitePaymentMethod } from '../billing/paysuite';
import { OrdersService } from '../orders/orders.service';
import { OutboxService } from '../reliability/outbox.service';

export type CommerceCheckoutInput = {
  addressId?: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
  couponCode?: string;
  affiliateCode?: string;
  paysuiteMethod: PaysuitePaymentMethod;
  msisdn?: string;
};

@Injectable()
export class CommerceService {
  constructor(
    private readonly orders: OrdersService,
    private readonly billing: BillingService,
    private readonly outbox: OutboxService,
  ) {}

  private mapOrderMethod(method: PaysuitePaymentMethod): PaymentMethod {
    switch (method) {
      case 'mpesa':
        return PaymentMethod.MPESA;
      case 'emola':
        return PaymentMethod.EMOLA;
      case 'credit_card':
        return PaymentMethod.CREDIT_CARD;
      default: {
        const _exhaustive: never = method;
        return _exhaustive;
      }
    }
  }

  async checkout(buyerId: string, input: CommerceCheckoutInput) {
    if (!input.paysuiteMethod) {
      throw new BadRequestException('paysuiteMethod é obrigatório');
    }

    const sagaId = `saga_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
    const steps: Array<{
      name: string;
      status: 'ok' | 'error';
      at: string;
      detail?: string;
    }> = [];

    const mark = (name: string, status: 'ok' | 'error', detail?: string) => {
      steps.push({ name, status, at: new Date().toISOString(), detail });
    };

    mark('validate', 'ok');

    const orderMethod =
      input.paymentMethod ?? this.mapOrderMethod(input.paysuiteMethod);

    const checkout = await this.orders.checkout(buyerId, {
      addressId: input.addressId,
      paymentMethod: orderMethod,
      notes: input.notes,
      couponCode: input.couponCode,
      affiliateCode: input.affiliateCode,
    });
    mark('create_orders', 'ok');

    const orderIds = checkout.orders.map((o) => o.id);
    const payment = await this.billing.createPaysuiteCheckout(
      buyerId,
      orderIds,
      input.paysuiteMethod,
      input.msisdn,
    );
    mark('create_payment', 'ok');
    mark('done', 'ok');

    await this.outbox.enqueue({
      aggregateType: 'CommerceCheckout',
      aggregateId: sagaId,
      eventType: 'commerce.checkout.completed',
      payload: {
        sagaId,
        buyerId,
        orderIds,
        paymentId: payment.paymentId,
        totalCents: checkout.totalCents,
      },
    });

    return {
      sagaId,
      steps,
      orders: checkout.orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        totalCents: o.totalCents,
        sellerShopId: o.sellerShopId,
      })),
      orderCount: checkout.orderCount,
      totalCents: checkout.totalCents,
      payment,
    };
  }
}
