import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ShippingQuote, ShippingQuoteRequest } from '@ishopine/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Phase 6 logistics stub — flat/free/pickup quotes from platform settings.
 * Carrier integrations deferred to Phase 7+.
 */
@Injectable()
export class LogisticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async quote(input: ShippingQuoteRequest): Promise<ShippingQuote[]> {
    const slug = this.config.get<string>('PLATFORM_ORG_SLUG', 'ishopine');
    const settings = await this.prisma.platformSettings.findFirst({
      where: { organization: { slug } },
    });

    const flat = settings?.shippingFlatCents ?? 5000;
    const freeAt = settings?.freeShippingCents ?? 150000;
    const quotes: ShippingQuote[] = [
      {
        method: "PICKUP",
        label: "Levantamento na loja",
        amountCents: 0,
        etaDaysMin: 0,
        etaDaysMax: 1,
      },
    ];

    if (input.subtotalCents >= freeAt) {
      quotes.unshift({
        method: "FREE",
        label: "Envio grátis",
        amountCents: 0,
        etaDaysMin: 2,
        etaDaysMax: 5,
      });
    } else {
      quotes.unshift({
        method: "FLAT",
        label: `Envio para ${input.destinationDistrict}`,
        amountCents: flat,
        etaDaysMin: 2,
        etaDaysMax: 7,
      });
    }

    return quotes;
  }
}
