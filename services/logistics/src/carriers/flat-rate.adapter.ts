import { CarrierCode } from "@prisma/client";
import type { CarrierAdapter, QuoteContext } from "./types";

export const flatRateAdapter: CarrierAdapter = {
  code: CarrierCode.FLAT_RATE,
  name: "Tarifa por zona",
  method: "FLAT",
  quote(ctx: QuoteContext) {
    const base = ctx.zone?.priceCents ?? ctx.platform.flatCents;
    const destination =
      ctx.request.destinationDistrict ||
      ctx.request.destinationProvince ||
      "destino";
    return {
      method: "FLAT",
      carrierCode: CarrierCode.FLAT_RATE,
      label: `Envio para ${destination}`,
      amountCents: base + ctx.weightSurchargeCents,
      etaDaysMin: ctx.zone?.etaMinDays ?? 2,
      etaDaysMax: ctx.zone?.etaMaxDays ?? 7,
    };
  },
  resolveTrackingCode({ orderNumber }) {
    return `ISH-${orderNumber}`;
  },
};
