import type { CarrierCode, ShippingQuote, ShippingQuoteRequest } from "@ishopine/shared";

export type ZoneRate = {
  priceCents: number;
  etaMinDays: number;
  etaMaxDays: number;
  province: string | null;
  city: string | null;
};

export type QuoteContext = {
  request: ShippingQuoteRequest;
  /** Resolved zone rate (province/city match or national fallback). */
  zone: ZoneRate | null;
  /** Platform flat/free thresholds from PlatformSettings. */
  platform: { flatCents: number; freeAtCents: number };
  /** Weight surcharge in cents (band above 2kg). */
  weightSurchargeCents: number;
};

export type CarrierAdapter = {
  code: CarrierCode;
  name: string;
  method: ShippingQuote["method"];
  /**
   * Build a quote for this carrier, or null if not applicable
   * (e.g. FREE_THRESHOLD when subtotal below limiar).
   */
  quote(ctx: QuoteContext): ShippingQuote | null;
  /**
   * Tracking code for label creation.
   * MANUAL requires seller-provided code; others use deterministic platform codes.
   */
  resolveTrackingCode(input: {
    orderNumber: string;
    sellerTrackingCode?: string;
  }): string;
};
