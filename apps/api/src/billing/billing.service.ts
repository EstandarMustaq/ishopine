import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BillingPaymentStatus,
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  PlatformRole,
  Prisma,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { InboxService } from '../reliability/inbox.service';
import { OutboxService } from '../reliability/outbox.service';
import {
  PaysuiteApiError,
  PaysuiteClient,
  PaysuiteValidationError,
  parsePaysuiteWebhook,
  verifyPaysuiteWebhookSignature,
  type PaysuitePaymentMethod,
} from './paysuite';

const METHOD_TO_ORDER: Record<PaysuitePaymentMethod, PaymentMethod> = {
  mpesa: PaymentMethod.MPESA,
  emola: PaymentMethod.EMOLA,
  credit_card: PaymentMethod.CREDIT_CARD,
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private client: PaysuiteClient | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly orders: OrdersService,
    private readonly inbox: InboxService,
    private readonly outbox: OutboxService,
  ) {
    const token = this.config.get<string>('PAYSUITE_TOKEN')?.trim();
    if (token) {
      this.client = new PaysuiteClient({
        token,
        baseUrl: this.config.get<string>('PAYSUITE_BASE_URL'),
        timeoutMs: Number(this.config.get('PAYSUITE_TIMEOUT_MS') || 30_000),
        maxRetries: Number(this.config.get('PAYSUITE_MAX_RETRIES') || 3),
      });
    } else {
      this.logger.warn(
        'PAYSUITE_TOKEN missing — billing requires PaySuite for real charges',
      );
    }
  }

  private webUrl(): string {
    return this.config.get<string>('WEB_URL', 'http://localhost:3000');
  }

  private apiPublicUrl(): string {
    return (
      this.config.get<string>('APP_URL') ||
      this.config.get<string>('API_PUBLIC_URL') ||
      `http://localhost:${this.config.get('API_PORT', 4000)}`
    );
  }

  private allowSimulate(): boolean {
    if (this.config.get<string>('PAYSUITE_SIMULATE') === 'true') return true;
    if (this.config.get<string>('NODE_ENV') === 'production') return false;
    return !this.client;
  }

  private getClientOrThrow(): PaysuiteClient {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'PaySuite não configurado. Defina PAYSUITE_TOKEN (painel PaySuite → API Access).',
      );
    }
    return this.client;
  }

  private shortReference(): string {
    return `ISH${Date.now().toString(36)}${randomBytes(3).toString('hex')}`.slice(
      0,
      50,
    );
  }

  private normalizeMsisdn(raw?: string): string | undefined {
    if (!raw) return undefined;
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('258')) return digits;
    if (digits.startsWith('8') && digits.length === 9) return `258${digits}`;
    return digits;
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

  async createPaysuiteCheckout(
    buyerId: string,
    orderIds: string[],
    method: PaysuitePaymentMethod,
    rawMsisdn?: string,
  ) {
    const buyer = await this.prisma.user.findUnique({ where: { id: buyerId } });
    if (!buyer) throw new ForbiddenException();

    const { orders, amountCents } = await this.loadPayableOrders(
      buyerId,
      orderIds,
    );
    const msisdn = this.normalizeMsisdn(rawMsisdn);
    const reference = this.shortReference();
    const orderMethod = METHOD_TO_ORDER[method];
    const amountMzn = (amountCents / 100).toFixed(2);

    const payment = await this.prisma.billingPayment.create({
      data: {
        buyerId,
        provider: PaymentProvider.PAYSUITE,
        status: BillingPaymentStatus.PENDING,
        amountCents,
        currency: 'MZN',
        orderIds: orders.map((o) => o.id),
        method,
        reference,
        msisdn,
        metadata: {
          orderNumbers: orders.map((o) => o.orderNumber),
          buyerEmail: buyer.email,
        },
      },
    });

    await this.prisma.order.updateMany({
      where: { id: { in: orders.map((o) => o.id) } },
      data: { paymentMethod: orderMethod },
    });
    await this.prisma.payment.updateMany({
      where: { orderId: { in: orders.map((o) => o.id) } },
      data: { method: orderMethod },
    });

    const returnUrl = `${this.webUrl()}/pagamento/sucesso?ref=${encodeURIComponent(reference)}`;
    const callbackUrl = `${this.apiPublicUrl()}/api/billing/paysuite/webhook`;

    if (this.allowSimulate() && !this.client) {
      await this.markBillingPaid(payment.id, {
        paysuitePaymentId: `sim_${payment.id}`,
        paysuiteTransactionId: `sim_tx_${Date.now()}`,
      });
      return {
        paymentId: payment.id,
        reference,
        provider: PaymentProvider.PAYSUITE,
        method,
        status: BillingPaymentStatus.PAID,
        amountCents,
        currency: 'MZN',
        checkoutUrl: `${this.webUrl()}/pagamento/sucesso?simulated=1&paymentId=${payment.id}`,
        url: `${this.webUrl()}/pagamento/sucesso?simulated=1&paymentId=${payment.id}`,
        simulated: true,
        message:
          'Simulação local (defina PAYSUITE_TOKEN para cobranças reais — PaySuite não tem sandbox).',
      };
    }

    try {
      const client = this.getClientOrThrow();
      const created = await client.createPayment({
        amount: amountMzn,
        reference,
        method,
        description: `iShopine · ${orders.length} pedido(s)`.slice(0, 125),
        return_url: returnUrl,
        callback_url: callbackUrl,
      });

      await this.prisma.billingPayment.update({
        where: { id: payment.id },
        data: {
          status: BillingPaymentStatus.PROCESSING,
          paysuitePaymentId: created.id,
          paysuiteCheckoutUrl: created.checkout_url,
          metadata: {
            orderNumbers: orders.map((o) => o.orderNumber),
            buyerEmail: buyer.email,
            paysuiteStatus: created.status,
            msisdnHint: msisdn,
          },
        },
      });

      const checkoutUrl = created.checkout_url;
      if (!checkoutUrl) {
        throw new BadRequestException(
          'PaySuite não devolveu checkout_url — verifique a conta comerciante',
        );
      }

      return {
        paymentId: payment.id,
        reference,
        provider: PaymentProvider.PAYSUITE,
        method,
        status: BillingPaymentStatus.PROCESSING,
        amountCents,
        currency: 'MZN',
        paysuitePaymentId: created.id,
        checkoutUrl,
        url: checkoutUrl,
        simulated: false,
        message: 'Redirecione o comprador para o checkout PaySuite.',
      };
    } catch (error) {
      const message = this.mapPaysuiteError(error);
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

  async syncPaysuiteStatus(buyerId: string, paymentId: string) {
    const payment = await this.prisma.billingPayment.findUnique({
      where: { id: paymentId },
    });
    if (!payment || payment.buyerId !== buyerId) {
      throw new NotFoundException('Pagamento não encontrado');
    }
    if (payment.provider !== PaymentProvider.PAYSUITE) {
      throw new BadRequestException('Pagamento não é PaySuite');
    }

    if (
      payment.status === BillingPaymentStatus.PAID ||
      payment.status === BillingPaymentStatus.FAILED ||
      payment.status === BillingPaymentStatus.CANCELLED ||
      payment.status === BillingPaymentStatus.REFUNDED
    ) {
      return {
        paymentId: payment.id,
        reference: payment.reference,
        status: payment.status,
        message: payment.failureReason || undefined,
      };
    }

    if (!payment.paysuitePaymentId) {
      return {
        paymentId: payment.id,
        reference: payment.reference,
        status: payment.status,
        message: 'Aguardando id PaySuite',
      };
    }

    if (this.allowSimulate() && payment.paysuitePaymentId.startsWith('sim_')) {
      await this.markBillingPaid(payment.id, {});
      return {
        paymentId: payment.id,
        reference: payment.reference,
        status: BillingPaymentStatus.PAID,
        message: 'Simulado',
      };
    }

    try {
      const remote = await this.getClientOrThrow().getPayment(
        payment.paysuitePaymentId,
      );
      const remoteStatus = String(remote.status || '').toLowerCase();

      if (remoteStatus === 'paid' || remoteStatus === 'completed') {
        await this.markBillingPaid(payment.id, {
          paysuiteTransactionId:
            remote.transaction?.transaction_id ||
            (remote.transaction?.id != null
              ? String(remote.transaction.id)
              : undefined),
        });
        return {
          paymentId: payment.id,
          reference: payment.reference,
          status: BillingPaymentStatus.PAID,
          message: 'Pago',
        };
      }

      if (
        remoteStatus === 'failed' ||
        remoteStatus === 'cancelled' ||
        remoteStatus === 'canceled' ||
        remoteStatus === 'expired'
      ) {
        const mapped =
          remoteStatus === 'expired' || remoteStatus.includes('cancel')
            ? BillingPaymentStatus.CANCELLED
            : BillingPaymentStatus.FAILED;
        await this.prisma.billingPayment.update({
          where: { id: payment.id },
          data: {
            status: mapped,
            failureReason: remote.error || remoteStatus,
          },
        });
        return {
          paymentId: payment.id,
          reference: payment.reference,
          status: mapped,
          message: remote.error || remoteStatus,
        };
      }

      return {
        paymentId: payment.id,
        reference: payment.reference,
        status: BillingPaymentStatus.PROCESSING,
        message: remoteStatus || 'pending',
      };
    } catch (error) {
      throw new BadRequestException(this.mapPaysuiteError(error));
    }
  }

  async handlePaysuiteWebhook(
    rawBody: Buffer,
    signature: string | undefined,
    accountId?: string,
  ) {
    const secret = this.config.get<string>('PAYSUITE_WEBHOOK_SECRET')?.trim();
    if (!secret) {
      this.logger.error('PAYSUITE_WEBHOOK_SECRET not configured');
      throw new ServiceUnavailableException('Webhook secret não configurado');
    }

    if (!verifyPaysuiteWebhookSignature(rawBody, signature, secret)) {
      throw new UnauthorizedException('Assinatura PaySuite inválida');
    }

    const payload = parsePaysuiteWebhook(rawBody);
    const requestId =
      payload.request_id ||
      `${payload.event}:${payload.data?.id}:${payload.created_at || Date.now()}`;

    const received = await this.inbox.receive({
      source: 'paysuite',
      messageKey: requestId,
      eventType: payload.event,
      payload,
      headers: { accountId, signaturePresent: Boolean(signature) },
    });

    await this.prisma.billingWebhookEvent.upsert({
      where: { requestId },
      create: {
        requestId,
        event: payload.event,
        payload: payload as unknown as Prisma.InputJsonValue,
        paymentId: payload.data?.id,
        processedAt: received.alreadyProcessed ? new Date() : null,
      },
      update: {
        event: payload.event,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });

    if (received.alreadyProcessed) {
      return { received: true, duplicate: true, via: 'inbox' };
    }

    try {
      const paysuiteId = payload.data?.id;
      const reference = payload.data?.reference;

      const payment = paysuiteId
        ? await this.prisma.billingPayment.findFirst({
            where: {
              OR: [
                { paysuitePaymentId: paysuiteId },
                ...(reference ? [{ reference }] : []),
              ],
            },
          })
        : reference
          ? await this.prisma.billingPayment.findUnique({
              where: { reference },
            })
          : null;

      if (payment) {
        if (payload.event === 'payment.success') {
          await this.markBillingPaid(payment.id, {
            paysuitePaymentId: paysuiteId || payment.paysuitePaymentId,
            paysuiteTransactionId:
              payload.data.transaction?.transaction_id ||
              (payload.data.transaction?.id != null
                ? String(payload.data.transaction.id)
                : undefined),
          });
        } else if (payload.event === 'payment.failed') {
          await this.prisma.billingPayment.update({
            where: { id: payment.id },
            data: {
              status: BillingPaymentStatus.FAILED,
              failureReason: payload.data.error || 'payment.failed',
            },
          });
          await this.outbox.enqueue({
            aggregateType: 'BillingPayment',
            aggregateId: payment.id,
            eventType: 'billing.payment.failed',
            payload: {
              paymentId: payment.id,
              buyerId: payment.buyerId,
              reference: payment.reference,
            },
          });
        }
      } else {
        this.logger.warn(
          `PaySuite webhook sem pagamento local: ${payload.event} ${paysuiteId || reference}`,
        );
      }

      await this.inbox.markProcessed(received.message.id);
      await this.prisma.billingWebhookEvent.update({
        where: { requestId },
        data: {
          processedAt: new Date(),
          paymentId: payment?.id || paysuiteId,
        },
      });

      this.logger.log(
        `PaySuite webhook ok event=${payload.event} account=${accountId || '-'} requestId=${requestId}`,
      );

      return { received: true, duplicate: received.duplicate, via: 'inbox' };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'webhook processing failed';
      await this.inbox.markFailed(received.message.id, message);
      throw error;
    }
  }

  async listPayments(buyerId: string) {
    return this.prisma.billingPayment.findMany({
      where: { buyerId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createSellerPayout(
    actor: { id: string; platformRole: PlatformRole },
    input: {
      reference: string;
      amountCents: number;
      method: 'mpesa' | 'emola';
      phone: string;
      holder: string;
      description?: string;
    },
  ) {
    if (
      actor.platformRole !== PlatformRole.PLATFORM_ADMIN &&
      actor.platformRole !== PlatformRole.PLATFORM_OPERATOR
    ) {
      throw new ForbiddenException();
    }
    if (input.amountCents <= 0) {
      throw new BadRequestException('Valor de payout inválido');
    }

    const client = this.getClientOrThrow();
    const phone = this.normalizeMsisdn(input.phone) || input.phone;

    try {
      const payout = await client.createPayout({
        amount: (input.amountCents / 100).toFixed(2),
        reference: input.reference.slice(0, 50),
        method: input.method,
        description: input.description,
        beneficiary: {
          phone: phone.replace(/^258/, ''),
          holder: input.holder,
        },
      });
      return payout;
    } catch (error) {
      throw new BadRequestException(this.mapPaysuiteError(error));
    }
  }

  async createRefund(
    actor: { id: string; platformRole: PlatformRole },
    input: { paymentId: string; amountCents: number; reason?: string },
  ) {
    if (
      actor.platformRole !== PlatformRole.PLATFORM_ADMIN &&
      actor.platformRole !== PlatformRole.PLATFORM_OPERATOR
    ) {
      throw new ForbiddenException();
    }

    const payment = await this.prisma.billingPayment.findUnique({
      where: { id: input.paymentId },
    });
    if (!payment?.paysuitePaymentId) {
      throw new NotFoundException('Pagamento PaySuite não encontrado');
    }
    if (payment.status !== BillingPaymentStatus.PAID) {
      throw new BadRequestException('Só é possível reembolsar pagamentos pagos');
    }

    const client = this.getClientOrThrow();
    try {
      const refund = await client.createRefund({
        payment_id: payment.paysuitePaymentId,
        amount: (input.amountCents / 100).toFixed(2),
        reason: input.reason,
      });

      if (input.amountCents >= payment.amountCents) {
        await this.prisma.billingPayment.update({
          where: { id: payment.id },
          data: { status: BillingPaymentStatus.REFUNDED },
        });
      }

      return refund;
    } catch (error) {
      throw new BadRequestException(this.mapPaysuiteError(error));
    }
  }

  private mapPaysuiteError(error: unknown): string {
    if (error instanceof PaysuiteValidationError) return error.message;
    if (error instanceof PaysuiteApiError) return error.message;
    if (error instanceof Error) return error.message;
    return 'Erro PaySuite desconhecido';
  }

  private async markBillingPaid(
    paymentId: string,
    extras: {
      paysuitePaymentId?: string | null;
      paysuiteTransactionId?: string | null;
    },
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
        paysuitePaymentId:
          extras.paysuitePaymentId ?? payment.paysuitePaymentId,
        paysuiteTransactionId:
          extras.paysuiteTransactionId ?? payment.paysuiteTransactionId,
      },
    });

    await this.orders.settlePaidOrders(payment.orderIds);

    await this.outbox.enqueue({
      aggregateType: 'BillingPayment',
      aggregateId: payment.id,
      eventType: 'billing.payment.paid',
      payload: {
        paymentId: payment.id,
        buyerId: payment.buyerId,
        reference: payment.reference,
        amountCents: payment.amountCents,
        currency: payment.currency,
        orderIds: payment.orderIds,
      },
    });
  }
}
