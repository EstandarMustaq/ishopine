import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private client: Stripe | null = null;

  constructor(private readonly config: ConfigService) {
    const secret = this.config.get<string>('STRIPE_SECRET_KEY');
    if (secret?.trim()) {
      this.client = new Stripe(secret);
    } else {
      this.logger.warn(
        'STRIPE_SECRET_KEY missing — Stripe Checkout will use sandbox simulation',
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(this.client);
  }

  getStripe(): Stripe {
    if (!this.client) {
      throw new Error('Stripe não configurado');
    }
    return this.client;
  }

  currency(): string {
    return (this.config.get<string>('STRIPE_CURRENCY') || 'usd').toLowerCase();
  }

  async createCheckoutSession(input: {
    amountCents: number;
    currency?: string;
    customerEmail?: string;
    paymentId: string;
    orderIds: string[];
    successUrl: string;
    cancelUrl: string;
  }): Promise<Stripe.Checkout.Session> {
    const stripe = this.getStripe();
    // Do not pass payment_method_types — let Stripe enable dynamic payment methods.
    return stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: input.customerEmail,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency || this.currency(),
            unit_amount: input.amountCents,
            product_data: {
              name: 'Pedido iShopine',
              description: `Pagamento de ${input.orderIds.length} pedido(s)`,
            },
          },
        },
      ],
      metadata: {
        billingPaymentId: input.paymentId,
        orderIds: input.orderIds.join(','),
      },
      payment_intent_data: {
        metadata: {
          billingPaymentId: input.paymentId,
          orderIds: input.orderIds.join(','),
        },
      },
    });
  }

  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const stripe = this.getStripe();
    const secret = this.config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET');
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
  }
}
