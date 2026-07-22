import { CarrierCode } from "@prisma/client";
import type { CarrierAdapter, QuoteContext } from "./types";

export const freeThresholdAdapter: CarrierAdapter = {
  code: CarrierCode.FREE_THRESHOLD,
  name: "Envio grátis (limiar)",
  method: "FREE",
  quote(ctx: QuoteContext) {
    if (ctx.request.subtotalCents < ctx.platform.freeAtCents) {
      return null;
    }
    return {
      method: "FREE",
      carrierCode: CarrierCode.FREE_THRESHOLD,
      label: "Envio grátis",
      amountCents: 0,
      etaDaysMin: ctx.zone?.etaMinDays ?? 2,
      etaDaysMax: ctx.zone?.etaMaxDays ?? 5,
    };
  },
  resolveTrackingCode({ orderNumber }) {
    return `ISH-FREE-${orderNumber}`;
  },
};
