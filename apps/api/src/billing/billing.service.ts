import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BillingPaymentStatus,
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { MpesaClient } from './mpesa.client';
import { StripeService } from './stripe.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly stripe: StripeService,
    private readonly mpesa: MpesaClient,
    private readonly orders: OrdersService,
  ) {}

  private webUrl(): string {
    return this.config.get<string>('WEB_URL', 'http://localhost:3000');
  }

  private normalizeMsisdn(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('258')) return digits;
    if (digits.startsWith('8') && digits.length === 9) return `258${digits}`;
    return digits;
  }

  private shortRef(): string {
    return randomBytes(6).toString('hex').slice(0, 12);
  }

  private async loadPayableOrders(buyerId: string, orderIds: string[]) {
    const uniqueIds = [...new Set(orderIds)];
    const orders = await this.prisma.order.findMany({
      where: { id: { in: uniqueIds }, buyerId },
      include: { payments: true },
    });

    if (orders.length !== uniqueIds.length) {
      throw new BadRequestException(
        'Um ou mais pedidos não foram encontrados para este comprador',
      );
    }

    for (const order of orders) {
      if (order.paymentStatus === PaymentStatus.PAID) {
        throw new BadRequestException(
          `Pedido ${order.orderNumber} já está pago`,
        );
      }
      if (
        order.status === OrderStatus.CANCELLED ||
        order.status === OrderStatus.REFUNDED
      ) {
        throw new BadRequestException(
          `Pedido ${order.orderNumber} não pode ser cobrado`,
        );
      }
    }

    const amountCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
    if (amountCents <= 0) {
      throw new BadRequestException('Valor a pagar inválido');
    }

    return { orders, amountCents };
  }

  async createStripeCheckout(buyerId: string, orderIds: string[]) {
    const buyer = await this.prisma.user.findUnique({ where: { id: buyerId } });
    if (!buyer) throw new ForbiddenException();

    const { orders, amountCents } = await this.loadPayableOrders(
      buyerId,
      orderIds,
    );

    const payment = await this.prisma.billingPayment.create({
      data: {
        buyerId,
        provider: PaymentProvider.STRIPE,
        status: BillingPaymentStatus.PENDING,
        amountCents,
        currency: this.stripe.currency().toUpperCase(),
        orderIds: orders.map((o) => o.id),
        metadata: {
          orderNumbers: orders.map((o) => o.orderNumber),
        },
      },
    });

    await this.prisma.order.updateMany({
      where: { id: { in: orders.map((o) => o.id) } },
      data: { paymentMethod: PaymentMethod.STRIPE },
    });
    await this.prisma.payment.updateMany({
      where: { orderId: { in: orders.map((o) => o.id) } },
      data: { method: PaymentMethod.STRIPE },
    });

    const successUrl = `${this.webUrl()}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${this.webUrl()}/pagamento/cancelado`;

    if (!this.stripe.isConfigured()) {
      // Dev simulation: mark paid immediately and return local success URL.
      await this.markBillingPaid(payment.id, {
        stripeSessionId: `sim_cs_${payment.id}`,
      });
      return {
        paymentId: payment.id,
        sessionId: `sim_cs_${payment.id}`,
        url: `${this.webUrl()}/pagamento/sucesso?simulated=1&paymentId=${payment.id}`,
        checkoutUrl: `${this.webUrl()}/pagamento/sucesso?simulated=1&paymentId=${payment.id}`,
        simulated: true,
      };
    }

    const session = await this.stripe.createCheckoutSession({
      amountCents,
      customerEmail: buyer.email,
      paymentId: payment.id,
      orderIds: orders.map((o) => o.id),
      successUrl,
      cancelUrl,
    });

    await this.prisma.billingPayment.update({
      where: { id: payment.id },
      data: {
        stripeSessionId: session.id,
        status: BillingPaymentStatus.PROCESSING,
        metadata: {
          orderNumbers: orders.map((o) => o.orderNumber),
          stripeMode: session.mode,
        },
      },
    });

    return {
      paymentId: payment.id,
      sessionId: session.id,
      url: session.url,
      checkoutUrl: session.url,
      simulated: false,
    };
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!signature) {
      throw new BadRequestException('Assinatura Stripe em falta');
    }
    if (!this.stripe.isConfigured()) {
      throw new BadRequestException('Stripe não configurado');
    }

    const event = this.stripe.constructWebhookEvent(rawBody, signature);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const paymentId = session.metadata?.billingPaymentId;
        if (paymentId) {
          await this.markBillingPaid(paymentId, {
            stripeSessionId: session.id,
            stripePaymentIntentId:
              typeof session.payment_intent === 'string'
                ? session.payment_intent
                : session.payment_intent?.id,
          });
        } else if (session.id) {
          const existing = await this.prisma.billingPayment.findUnique({
            where: { stripeSessionId: session.id },
          });
          if (existing) {
            await this.markBillingPaid(existing.id, {
              stripeSessionId: session.id,
              stripePaymentIntentId:
                typeof session.payment_intent === 'string'
                  ? session.payment_intent
                  : session.payment_intent?.id,
            });
          }
        }
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object;
        if (session.id) {
          await this.prisma.billingPayment.updateMany({
            where: {
              stripeSessionId: session.id,
              status: {
                in: [
                  BillingPaymentStatus.PENDING,
                  BillingPaymentStatus.PROCESSING,
                ],
              },
            },
            data: {
              status: BillingPaymentStatus.CANCELLED,
              failureReason: 'Checkout session expired',
            },
          });
        }
        break;
      }
      default: {
        this.logger.debug(`Stripe event ignorado: ${event.type}`);
        break;
      }
    }

    return { received: true };
  }

  async initiateMpesaC2b(
    buyerId: string,
    orderIds: string[],
    rawMsisdn: string,
  ) {
    const msisdn = this.normalizeMsisdn(rawMsisdn);
    if (!/^(258)?8\d{8}$/.test(msisdn) && !/^2588\d{8}$/.test(msisdn)) {
      throw new BadRequestException('Número M-Pesa inválido');
    }

    const { orders, amountCents } = await this.loadPayableOrders(
      buyerId,
      orderIds,
    );

    const thirdPartyReference = this.shortRef();
    const transactionReference = `ISH${thirdPartyReference}`.slice(0, 20);

    const payment = await this.prisma.billingPayment.create({
      data: {
        buyerId,
        provider: PaymentProvider.MPESA,
        status: BillingPaymentStatus.PROCESSING,
        amountCents,
        currency: 'MZN',
        orderIds: orders.map((o) => o.id),
        msisdn,
        mpesaThirdPartyRef: thirdPartyReference,
        metadata: {
          orderNumbers: orders.map((o) => o.orderNumber),
          transactionReference,
        },
      },
    });

    await this.prisma.order.updateMany({
      where: { id: { in: orders.map((o) => o.id) } },
      data: { paymentMethod: PaymentMethod.MPESA },
    });
    await this.prisma.payment.updateMany({
      where: { orderId: { in: orders.map((o) => o.id) } },
      data: { method: PaymentMethod.MPESA },
    });

    try {
      const result = await this.mpesa.c2bSingleStage({
        amountCents,
        msisdn,
        transactionReference,
        thirdPartyReference,
      });

      const successCodes = new Set(['INS-0', '0', undefined]);
      const ok =
        result.simulated ||
        !result.responseCode ||
        successCodes.has(result.responseCode);

      if (!ok) {
        await this.prisma.billingPayment.update({
          where: { id: payment.id },
          data: {
            status: BillingPaymentStatus.FAILED,
            failureReason: result.responseDesc || result.responseCode,
            mpesaConversationId: result.conversationId,
            mpesaTransactionId: result.transactionId,
          },
        });
        throw new BadRequestException(
          result.responseDesc || 'Falha ao iniciar M-Pesa',
        );
      }

      await this.prisma.billingPayment.update({
        where: { id: payment.id },
        data: {
          mpesaConversationId: result.conversationId,
          mpesaTransactionId: result.transactionId,
          metadata: {
            orderNumbers: orders.map((o) => o.orderNumber),
            transactionReference,
            simulated: result.simulated,
            responseCode: result.responseCode,
            responseDesc: result.responseDesc,
          },
        },
      });

      // Simulated sandbox auto-settles so local demos work without Vodacom keys.
      if (result.simulated) {
        await this.markBillingPaid(payment.id, {
          mpesaConversationId: result.conversationId,
          mpesaTransactionId: result.transactionId,
        });
        return {
          paymentId: payment.id,
          status: BillingPaymentStatus.PAID,
          message:
            'Pagamento M-Pesa simulado com sucesso (configure as chaves Vodacom para produção).',
          simulated: true,
        };
      }

      return {
        paymentId: payment.id,
        status: BillingPaymentStatus.PROCESSING,
        message:
          'Pedido M-Pesa enviado. Confirme o PIN no telemóvel (USSD Push).',
        simulated: false,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const message =
        error instanceof Error ? error.message : 'Erro M-Pesa desconhecido';
      await this.prisma.billingPayment.update({
        where: { id: payment.id },
        data: {
          status: BillingPaymentStatus.FAILED,
          failureReason: message,
        },
      });
      throw new BadRequestException(message);
    }
  }

  async getMpesaStatus(buyerId: string, paymentId: string) {
    const payment = await this.prisma.billingPayment.findUnique({
      where: { id: paymentId },
    });
    if (!payment || payment.buyerId !== buyerId) {
      throw new NotFoundException('Pagamento não encontrado');
    }
    if (payment.provider !== PaymentProvider.MPESA) {
      throw new BadRequestException('Pagamento não é M-Pesa');
    }

    if (
      payment.status === BillingPaymentStatus.PAID ||
      payment.status === BillingPaymentStatus.FAILED ||
      payment.status === BillingPaymentStatus.CANCELLED ||
      payment.status === BillingPaymentStatus.REFUNDED
    ) {
      return {
        paymentId: payment.id,
        status: payment.status,
        message: payment.failureReason || undefined,
      };
    }

    const queryReference =
      payment.mpesaConversationId ||
      payment.mpesaTransactionId ||
      payment.mpesaThirdPartyRef;

    if (!queryReference || !payment.mpesaThirdPartyRef) {
      return {
        paymentId: payment.id,
        status: payment.status,
        message: 'Aguardando referência M-Pesa',
      };
    }

    const query = await this.mpesa.queryStatus({
      thirdPartyReference: payment.mpesaThirdPartyRef,
      queryReference,
    });

    if (query.status === 'Completed') {
      await this.markBillingPaid(payment.id, {
        mpesaConversationId: query.conversationId || payment.mpesaConversationId,
      });
      return {
        paymentId: payment.id,
        status: BillingPaymentStatus.PAID,
        message: query.responseDesc || 'Pago',
      };
    }

    if (
      query.status === 'Failed' ||
      query.status === 'Cancelled' ||
      query.status === 'Expired'
    ) {
      const mapped =
        query.status === 'Cancelled'
          ? BillingPaymentStatus.CANCELLED
          : BillingPaymentStatus.FAILED;
      await this.prisma.billingPayment.update({
        where: { id: payment.id },
        data: {
          status: mapped,
          failureReason: query.responseDesc || query.status,
        },
      });
      return {
        paymentId: payment.id,
        status: mapped,
        message: query.responseDesc || query.status,
      };
    }

    return {
      paymentId: payment.id,
      status: BillingPaymentStatus.PROCESSING,
      message: query.responseDesc || 'Aguardando confirmação M-Pesa',
    };
  }

  async handleMpesaCallback(body: {
    input_OriginalConversationID?: string;
    input_ThirdPartyReference?: string;
    input_TransactionID?: string;
    input_ResultCode?: string;
    input_ResultDesc?: string;
  }) {
    const thirdParty = body.input_ThirdPartyReference;
    const conversationId = body.input_OriginalConversationID;

    const payment = thirdParty
      ? await this.prisma.billingPayment.findFirst({
          where: { mpesaThirdPartyRef: thirdParty },
        })
      : conversationId
        ? await this.prisma.billingPayment.findFirst({
            where: { mpesaConversationId: conversationId },
          })
        : null;

    if (payment) {
      const ok =
        body.input_ResultCode === '0' || body.input_ResultCode === 'INS-0';
      if (ok) {
        await this.markBillingPaid(payment.id, {
          mpesaConversationId: conversationId || payment.mpesaConversationId,
          mpesaTransactionId:
            body.input_TransactionID || payment.mpesaTransactionId,
        });
      } else {
        await this.prisma.billingPayment.update({
          where: { id: payment.id },
          data: {
            status: BillingPaymentStatus.FAILED,
            failureReason: body.input_ResultDesc || body.input_ResultCode,
            mpesaConversationId:
              conversationId || payment.mpesaConversationId,
            mpesaTransactionId:
              body.input_TransactionID || payment.mpesaTransactionId,
          },
        });
      }
    }

    return {
      output_OriginalConversationID: conversationId || '',
      output_ResponseDesc: 'Successfully Accepted Result',
      output_ResponseCode: '0',
      output_ThirdPartyConversationID: thirdParty || '',
    };
  }

  async listPayments(buyerId: string) {
    return this.prisma.billingPayment.findMany({
      where: { buyerId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private async markBillingPaid(
    paymentId: string,
    extras: {
      stripeSessionId?: string | null;
      stripePaymentIntentId?: string | null;
      mpesaConversationId?: string | null;
      mpesaTransactionId?: string | null;
    } = {},
  ) {
    const payment = await this.prisma.billingPayment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) return;
    if (payment.status === BillingPaymentStatus.PAID) return;

    await this.prisma.billingPayment.update({
      where: { id: paymentId },
      data: {
        status: BillingPaymentStatus.PAID,
        paidAt: new Date(),
        stripeSessionId: extras.stripeSessionId ?? payment.stripeSessionId,
        stripePaymentIntentId:
          extras.stripePaymentIntentId ?? payment.stripePaymentIntentId,
        mpesaConversationId:
          extras.mpesaConversationId ?? payment.mpesaConversationId,
        mpesaTransactionId:
          extras.mpesaTransactionId ?? payment.mpesaTransactionId,
      },
    });

    await this.orders.settlePaidOrders(payment.orderIds);
  }
}
