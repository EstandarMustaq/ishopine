import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CarrierCode,
  Prisma,
  ShipmentStatus,
} from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import type { ShippingQuote, ShippingQuoteRequest } from '@ishopine/shared';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../reliability/outbox.service';
import { getCarrierAdapter, listCarrierAdapters } from './carriers/registry';
import { isDhlExpressConfigured } from './carriers/dhl-express.adapter';
import type { ZoneRate } from './carriers/types';

const WEBHOOK_STATUSES = new Set<ShipmentStatus>([
  ShipmentStatus.LABEL_CREATED,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.OUT_FOR_DELIVERY,
  ShipmentStatus.DELIVERED,
  ShipmentStatus.CANCELLED,
  ShipmentStatus.RETURNED,
]);

@Injectable()
export class LogisticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly outbox: OutboxService,
  ) {}

  listCarriers() {
    return listCarrierAdapters().map((a) => ({
      code: a.code,
      name: a.name,
      method: a.method,
      live:
        a.code === CarrierCode.DHL_EXPRESS ? isDhlExpressConfigured() : false,
    }));
  }

  /** Phase 23: partner capability report (no fake Correios). */
  listCarrierPartners() {
    return {
      local: listCarrierAdapters()
        .filter((a) => a.code !== CarrierCode.DHL_EXPRESS)
        .map((a) => ({
          code: a.code,
          name: a.name,
          method: a.method,
          mode: 'local' as const,
        })),
      live: [
        {
          code: 'DHL_EXPRESS',
          name: 'DHL Express (MyDHL API)',
          configured: isDhlExpressConfigured(),
          mode: 'http' as const,
          docs: 'https://developer.dhl.com/api-reference/dhl-express-mydhl-api',
          env: [
            'DHL_EXPRESS_API_KEY',
            'DHL_EXPRESS_API_SECRET',
            'DHL_EXPRESS_ACCOUNT_NUMBER',
          ],
        },
        {
          code: 'CORREIOS_MZ',
          name: 'Correios de Moçambique',
          configured: false,
          mode: 'unavailable' as const,
          reason:
            'Sem API pública/contratada no monorepo — pedidos legacy mapeiam para MANUAL',
          mapsTo: 'MANUAL',
        },
      ],
    };
  }

  private async platformShipping() {
    const slug = this.config.get<string>('PLATFORM_ORG_SLUG', 'ishopine');
    const settings = await this.prisma.platformSettings.findFirst({
      where: { organization: { slug } },
    });
    return {
      flatCents: settings?.shippingFlatCents ?? 4900,
      freeAtCents: settings?.freeShippingCents ?? 99900,
    };
  }

  /** Weight surcharge: +500c per kg above 2kg. */
  private weightSurchargeCents(weightKg?: number) {
    if (weightKg == null || weightKg <= 2) return 0;
    return Math.ceil(weightKg - 2) * 500;
  }

  private normalizeGeo(value?: string | null) {
    return (value ?? '').trim().toLowerCase() || null;
  }

  /**
   * Resolve rate zone: city+province → province → national (null/null).
   */
  async resolveZone(
    carrierCode: CarrierCode,
    province: string,
    city?: string,
    weightKg?: number,
  ): Promise<ZoneRate | null> {
    const weightGrams =
      weightKg != null && Number.isFinite(weightKg)
        ? Math.round(weightKg * 1000)
        : null;

    const zones = await this.prisma.shippingRateZone.findMany({
      where: { carrierCode, active: true },
      orderBy: { sortOrder: 'asc' },
    });
    if (zones.length === 0) return null;

    const p = this.normalizeGeo(province);
    const c = this.normalizeGeo(city);

    const matchesWeight = (z: (typeof zones)[number]) =>
      z.maxWeightGrams == null ||
      weightGrams == null ||
      weightGrams <= z.maxWeightGrams;

    const pick = (
      pred: (z: (typeof zones)[number]) => boolean,
    ): ZoneRate | null => {
      const hit = zones.find((z) => pred(z) && matchesWeight(z));
      if (!hit) return null;
      return {
        priceCents: hit.priceCents,
        etaMinDays: hit.etaMinDays,
        etaMaxDays: hit.etaMaxDays,
        province: hit.province,
        city: hit.city,
      };
    };

    return (
      pick(
        (z) =>
          this.normalizeGeo(z.province) === p &&
          c != null &&
          this.normalizeGeo(z.city) === c,
      ) ||
      pick(
        (z) =>
          this.normalizeGeo(z.province) === p &&
          (z.city == null || z.city === ''),
      ) ||
      pick((z) => z.province == null && z.city == null)
    );
  }

  async quote(input: ShippingQuoteRequest): Promise<ShippingQuote[]> {
    const platform = await this.platformShipping();
    const weightSurchargeCents = this.weightSurchargeCents(input.weightKg);
    const quotes: ShippingQuote[] = [];

    for (const adapter of listCarrierAdapters()) {
      const zone = await this.resolveZone(
        adapter.code as CarrierCode,
        input.destinationProvince,
        input.destinationDistrict,
        input.weightKg,
      );
      const q = await adapter.quote({
        request: input,
        zone,
        platform,
        weightSurchargeCents,
      });
      if (q) quotes.push(q);
    }

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
  async resolveCheckoutShipping(
    input: ShippingQuoteRequest & {
      preferredMethod?: ShippingQuote['method'];
      preferredCarrier?: string;
    },
  ) {
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
      include: {
        order: { select: { orderNumber: true } },
      },
    });
    if (!shipment) {
      throw new NotFoundException('Envio não encontrado para este pedido');
    }

    const adapter = getCarrierAdapter(shipment.carrierCode);
    const code = adapter.resolveTrackingCode({
      orderNumber: shipment.order.orderNumber,
      sellerTrackingCode: trackingCode,
    });

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
    rawPayload?: Prisma.InputJsonValue,
  ) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
    });
    if (!shipment) throw new NotFoundException('Envio não encontrado');
    const data: Prisma.ShipmentUpdateInput = {
      status,
      events: {
        create: {
          status,
          note,
          ...(rawPayload !== undefined ? { rawPayload } : {}),
        },
      },
    };
    if (status === ShipmentStatus.DELIVERED) {
      data.deliveredAt = new Date();
    }
    if (
      status === ShipmentStatus.IN_TRANSIT ||
      status === ShipmentStatus.OUT_FOR_DELIVERY
    ) {
      data.shippedAt = shipment.shippedAt ?? new Date();
    }
    return this.prisma.shipment.update({
      where: { id: shipmentId },
      data,
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

  /** Printable HTML shipping label (A6-ish). */
  async renderLabelHtml(id: string): Promise<string> {
    const shipment = await this.getShipment(id);
    if (!shipment) throw new NotFoundException('Envio não encontrado');
    const adapter = getCarrierAdapter(shipment.carrierCode);
    const order = shipment.order;
    const tracking = shipment.trackingCode ?? '—';
    const dest = [shipment.destinationDistrict, shipment.destinationProvince]
      .filter(Boolean)
      .join(', ');
    const amount = (shipment.amountCents / 100).toFixed(2);

    return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>Etiqueta ${tracking}</title>
  <style>
    @page { size: 105mm 148mm; margin: 8mm; }
    body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; margin: 0; padding: 12px; }
    h1 { font-size: 18px; margin: 0 0 4px; letter-spacing: 0.04em; }
    .meta { font-size: 11px; color: #555; margin-bottom: 16px; }
    .box { border: 2px solid #111; padding: 12px; margin-bottom: 12px; }
    .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #666; }
    .value { font-size: 16px; font-weight: 700; margin-top: 2px; word-break: break-all; }
    .row { display: flex; gap: 12px; }
    .row > div { flex: 1; }
    .barcode { font-family: ui-monospace, monospace; font-size: 22px; letter-spacing: 0.12em; text-align: center; padding: 10px 0; border: 1px dashed #333; }
  </style>
</head>
<body>
  <h1>iShopine</h1>
  <p class="meta">${adapter.name} · ${shipment.method} · Pedido ${order.orderNumber}</p>
  <div class="box">
    <div class="label">Tracking</div>
    <div class="value">${escapeHtml(tracking)}</div>
  </div>
  <div class="barcode">${escapeHtml(tracking)}</div>
  <div class="row">
    <div class="box">
      <div class="label">Destino</div>
      <div class="value">${escapeHtml(dest || '—')}</div>
    </div>
    <div class="box">
      <div class="label">Portes (MZN)</div>
      <div class="value">${amount}</div>
    </div>
  </div>
  <p class="meta">Shipment ${shipment.id} · ${shipment.status}</p>
</body>
</html>`;
  }

  verifyCarrierWebhookSignature(rawBody: string, signatureHeader?: string) {
    const secret = this.config.get<string>('CARRIER_WEBHOOK_SECRET');
    if (!secret) {
      throw new UnauthorizedException(
        'CARRIER_WEBHOOK_SECRET não configurado',
      );
    }
    if (!signatureHeader) {
      throw new UnauthorizedException('Assinatura em falta');
    }
    const provided = signatureHeader.replace(/^sha256=/i, '').trim();
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Assinatura inválida');
    }
  }

  async handleCarrierWebhook(
    carrierParam: string,
    body: {
      trackingCode?: string;
      shipmentId?: string;
      status?: string;
      note?: string;
    },
    rawBody: string,
    signatureHeader?: string,
  ) {
    this.verifyCarrierWebhookSignature(rawBody, signatureHeader);

    const carrierCode = this.parseCarrierCode(carrierParam.toUpperCase());
    const statusRaw = (body.status || '').toUpperCase();
    if (!WEBHOOK_STATUSES.has(statusRaw as ShipmentStatus)) {
      throw new BadRequestException(`Status inválido: ${body.status}`);
    }
    const status = statusRaw as ShipmentStatus;

    const shipment = body.shipmentId
      ? await this.prisma.shipment.findUnique({ where: { id: body.shipmentId } })
      : body.trackingCode
        ? await this.prisma.shipment.findFirst({
            where: {
              trackingCode: body.trackingCode,
              carrierCode,
              status: { not: ShipmentStatus.CANCELLED },
            },
            orderBy: { createdAt: 'desc' },
          })
        : null;

    if (!shipment) {
      throw new NotFoundException('Envio não encontrado para o webhook');
    }
    if (shipment.carrierCode !== carrierCode) {
      throw new BadRequestException('Carrier do webhook não coincide');
    }

    const updated = await this.advanceStatus(
      shipment.id,
      status,
      body.note || `Webhook ${carrierCode}`,
      body as unknown as Prisma.InputJsonValue,
    );

    await this.outbox.enqueue({
      aggregateType: 'shipment',
      aggregateId: shipment.id,
      eventType: 'shipping.status.updated',
      payload: {
        shipmentId: shipment.id,
        orderId: shipment.orderId,
        carrierCode,
        status,
        trackingCode: shipment.trackingCode,
      },
    });

    return updated;
  }

  parseCarrierCode(value?: string): CarrierCode {
    if (!value) return CarrierCode.FLAT_RATE;
    // Legacy Phase 7 mock — map to MANUAL (no fake Correios).
    if (value === 'CORREIOS_MZ') return CarrierCode.MANUAL;
    if (Object.values(CarrierCode).includes(value as CarrierCode)) {
      return value as CarrierCode;
    }
    throw new BadRequestException(`Carrier inválido: ${value}`);
  }

  toPrismaJson(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
