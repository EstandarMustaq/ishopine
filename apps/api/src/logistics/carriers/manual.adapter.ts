import { BadRequestException } from '@nestjs/common';
import { CarrierCode } from '@prisma/client';
import type { CarrierAdapter, QuoteContext } from './types';

export const manualAdapter: CarrierAdapter = {
  code: CarrierCode.MANUAL,
  name: 'Envio manual do seller',
  method: 'CUSTOM',
  quote(ctx: QuoteContext) {
    const base = ctx.zone?.priceCents ?? ctx.platform.flatCents;
    return {
      method: 'CUSTOM',
      carrierCode: CarrierCode.MANUAL,
      label: 'Envio pelo vendedor',
      amountCents: base + ctx.weightSurchargeCents,
      etaDaysMin: ctx.zone?.etaMinDays ?? 3,
      etaDaysMax: ctx.zone?.etaMaxDays ?? 14,
    };
  },
  resolveTrackingCode({ sellerTrackingCode }) {
    const code = sellerTrackingCode?.trim();
    if (!code) {
      throw new BadRequestException(
        'Envio MANUAL exige trackingCode fornecido pelo vendedor',
      );
    }
    if (code.length < 4 || code.length > 64) {
      throw new BadRequestException(
        'trackingCode inválido (4–64 caracteres)',
      );
    }
    return code;
  },
};
