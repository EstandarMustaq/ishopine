import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CarrierCode,
  Prisma,
  ShipmentStatus,
} from '@prisma/client';
import type { ShippingQuote, ShippingQuoteRequest } from '@ishopine/shared';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../reliability/outbox.service';

export type CarrierDefinition = {
  code: CarrierCode;
  name: string;
  method: ShippingQuote['method'];
  mock: boolean;
};

const CARRIERS: CarrierDefinition[] = [
  {
    code: CarrierCode.STORE_PICKUP,
    name: 'Levantamento na loja',
    method: 'PICKUP',
    mock: false,
  },
  {
    code: CarrierCode.FLAT_RATE,
    name: 'Tarifa plana iShopine',
    method: 'FLAT',
    mock: false,
  },
  {
    code: CarrierCode.FREE_THRESHOLD,
    name: 'Envio grátis (limiar)',
    method: 'FREE',
    mock: false,
  },
  {
    code: CarrierCode.CORREIOS_MZ,
    name: 'Correios de Moçambique (mock)',
    method: 'CUSTOM',
    mock: true,
  },
  {
    code: CarrierCode.MANUAL,
    name: 'Envio manual do seller',
    method: 'CUSTOM',
    mock: false,
  },
];

@Injectable()
export class LogisticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly outbox: OutboxService,
  ) {}

  listCarriers() {
    return CARRIERS;
  }

  private async platformShipping() {
    const slug = this.config.get<string>('PLATFORM_ORG_SLUG', 'ishopine');
    const settings = await this.prisma.platformSettings.findFirst({
      where: { organization: { slug } },
    });
    return {
      flat: settings?.shippingFlatCents ?? 4900,
      freeAt: settings?.freeShippingCents ?? 99900,
    };
  }

  /**
   * Weight surcharge: +500c per kg above 2kg (simple band).
   */
  private weightSurchargeCents(weightKg?: number) {
    if (weightKg == null || weightKg <= 2) return 0;
    return Math.ceil(weightKg - 2) * 500;
  }

  async quote(input: ShippingQuoteRequest): Promise<ShippingQuote[]> {
    const { flat, freeAt } = await this.platformShipping();
    const surcharge = this.weightSurchargeCents(input.weightKg);
    const quotes: ShippingQuote[] = [
      {
        method: 'PICKUP',
        carrierCode: 'STORE_PICKUP',
        label: 'Levantamento na loja',
        amountCents: 0,
        etaDaysMin: 0,
        etaDaysMax: 1,
      },
    ];

    if (input.subtotalCents >= freeAt) {
      quotes.unshift({
        method: 'FREE',
        carrierCode: 'FREE_THRESHOLD',
        label: 'Envio grátis',
        amountCents: 0,
        etaDaysMin: 2,
        etaDaysMax: 5,
      });
    } else {
      quotes.unshift({
        method: 'FLAT',
        carrierCode: 'FLAT_RATE',
        label: `Envio para ${input.destinationDistrict}`,
        amountCents: flat + surcharge,
        etaDaysMin: 2,
        etaDaysMax: 7,
      });
    }

    // Mock Correios option (always available, priced like flat + 20%).
    quotes.push({
      method: 'CUSTOM',
      carrierCode: 'CORREIOS_MZ',
      label: 'Correios MZ (simulado)',
      amountCents: Math.round((flat + surcharge) * 1.2),
      etaDaysMin: 3,
      etaDaysMax: 10,
    });

    await this.outbox.enqueue({
      aggregateType: 'shipping',
      aggregateId: input.shopId || input.tenantId || 'platform',
      eventType: 'shipping.quote.requested',
      payload: {
        destinationProvince: input.destinationProvince,
        destinationDistrict: input.destinationDistrict,
        subtotalCents: input.subtotalCents,
        quoteCount: quotes.length,
      },
    });

    return quotes;
  }

  /** Pick best default quote for checkout (FREE > FLAT > first). */
  async resolveCheckoutShipping(input: ShippingQuoteRequest & {
    preferredMethod?: ShippingQuote['method'];
    preferredCarrier?: string;
  }) {
    const quotes = await this.quote(input);
    if (input.preferredCarrier) {
      const match = quotes.find((q) => q.carrierCode === input.preferredCarrier);
      if (match) return match;
    }
    if (input.preferredMethod) {
      const match = quotes.find((q) => q.method === input.preferredMethod);
      if (match) return match;
    }
    return (
      quotes.find((q) => q.method === 'FREE') ||
      quotes.find((q) => q.method === 'FLAT') ||
      quotes[0]
    );
  }

  async ensureShipmentForOrder(input: {
    orderId: string;
    carrierCode: CarrierCode;
    method: string;
    amountCents: number;
    destinationProvince?: string;
    destinationDistrict?: string;
    weightKg?: number;
  }) {
    const existing = await this.prisma.shipment.findFirst({
      where: { orderId: input.orderId, status: { not: ShipmentStatus.CANCELLED } },
    });
    if (existing) return existing;

    return this.prisma.shipment.create({
      data: {
        orderId: input.orderId,
        carrierCode: input.carrierCode,
        method: input.method,
        amountCents: input.amountCents,
        destinationProvince: input.destinationProvince,
        destinationDistrict: input.destinationDistrict,
        weightKg: input.weightKg,
        status: ShipmentStatus.PENDING,
        events: {
          create: {
            status: ShipmentStatus.PENDING,
            note: 'Envio criado no checkout',
          },
        },
      },
      include: { events: true },
    });
  }

  async createLabel(orderId: string, trackingCode?: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { orderId, status: { not: ShipmentStatus.CANCELLED } },
      orderBy: { createdAt: 'desc' },
    });
    if (!shipment) {
      throw new NotFoundException('Envio não encontrado para este pedido');
    }

    const code =
      trackingCode?.trim() ||
      `MZ${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, '0')}`;

    const updated = await this.prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: ShipmentStatus.LABEL_CREATED,
        trackingCode: code,
        labelUrl: `/api/logistics/shipments/${shipment.id}/label`,
        shippedAt: new Date(),
        events: {
          create: {
            status: ShipmentStatus.LABEL_CREATED,
            note: `Etiqueta gerada · ${code}`,
          },
        },
      },
      include: { events: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });

    await this.outbox.enqueue({
      aggregateType: 'shipment',
      aggregateId: updated.id,
      eventType: 'shipping.label.created',
      payload: {
        shipmentId: updated.id,
        orderId,
        carrierCode: updated.carrierCode,
        trackingCode: updated.trackingCode,
      },
    });

    return updated;
  }

  async markInTransit(shipmentId: string) {
    return this.advanceStatus(shipmentId, ShipmentStatus.IN_TRANSIT, 'Em trânsito');
  }

  async markDelivered(shipmentId: string) {
    const updated = await this.advanceStatus(
      shipmentId,
      ShipmentStatus.DELIVERED,
      'Entregue',
    );
    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { deliveredAt: new Date() },
    });
    return updated;
  }

  private async advanceStatus(
    shipmentId: string,
    status: ShipmentStatus,
    note: string,
  ) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
    });
    if (!shipment) throw new NotFoundException('Envio não encontrado');
    return this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status,
        events: { create: { status, note } },
      },
      include: { events: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
  }

  listShipments(opts: { shopId?: string; orderId?: string; take?: number }) {
    return this.prisma.shipment.findMany({
      where: {
        ...(opts.orderId ? { orderId: opts.orderId } : {}),
        ...(opts.shopId ? { order: { sellerShopId: opts.shopId } } : {}),
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            sellerShopId: true,
          },
        },
        events: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, Math.max(1, opts.take ?? 40)),
    });
  }

  getShipment(id: string) {
    return this.prisma.shipment.findUnique({
      where: { id },
      include: {
        order: true,
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  parseCarrierCode(value?: string): CarrierCode {
    if (!value) return CarrierCode.FLAT_RATE;
    if (Object.values(CarrierCode).includes(value as CarrierCode)) {
      return value as CarrierCode;
    }
    throw new BadRequestException(`Carrier inválido: ${value}`);
  }

  toPrismaJson(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }
}
