/**
 * Phase 23: DHL Express MyDHL API — fail-closed live rates.
 * Only quotes when DHL_EXPRESS_API_KEY + SECRET + ACCOUNT are set.
 * Never invents prices; HTTP errors → null (skip carrier).
 *
 * @see https://developer.dhl.com/api-reference/dhl-express-mydhl-api
 */
import { CarrierCode } from "@prisma/client";
import type { CarrierAdapter, QuoteContext } from "./types";

export function isDhlExpressConfigured(): boolean {
  return Boolean(
    process.env.DHL_EXPRESS_API_KEY?.trim() &&
      process.env.DHL_EXPRESS_API_SECRET?.trim() &&
      process.env.DHL_EXPRESS_ACCOUNT_NUMBER?.trim(),
  );
}

function dhlBaseUrl() {
  const env = (process.env.DHL_EXPRESS_ENV || "test").toLowerCase();
  if (env === "production" || env === "prod") {
    return "https://express.api.dhl.com/mydhlapi";
  }
  return (
    process.env.DHL_EXPRESS_BASE_URL?.trim() ||
    "https://express.api.dhl.com/mydhlapi/test"
  );
}

function authHeader() {
  const key = process.env.DHL_EXPRESS_API_KEY!.trim();
  const secret = process.env.DHL_EXPRESS_API_SECRET!.trim();
  return `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`;
}

function plannedShippingIso() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  // MyDHL expects local-ish ISO without ms, with offset — use Z.
  return d.toISOString().replace(/\.\d{3}Z$/, "GMT+00:00");
}

type DhlRateProduct = {
  productName?: string;
  productCode?: string;
  totalPrice?: Array<{ price?: number; priceCurrency?: string }>;
  deliveryCapabilities?: {
    estimatedDeliveryDateAndTime?: string;
    totalTransitDays?: number;
  };
};

async function fetchDhlRates(
  ctx: QuoteContext,
): Promise<ReturnType<CarrierAdapter["quote"]>> {
  const account = process.env.DHL_EXPRESS_ACCOUNT_NUMBER!.trim();
  const originCountry = (
    process.env.DHL_EXPRESS_ORIGIN_COUNTRY || "MZ"
  ).toUpperCase();
  const originCity =
    process.env.DHL_EXPRESS_ORIGIN_CITY?.trim() || "Maputo";
  const originPostal =
    process.env.DHL_EXPRESS_ORIGIN_POSTAL?.trim() || "1100";
  const destCountry = (
    process.env.DHL_EXPRESS_DEST_COUNTRY || "MZ"
  ).toUpperCase();
  const weight = Math.max(0.5, ctx.request.weightKg ?? 1);

  const body = {
    customerDetails: {
      shipperDetails: {
        postalCode: originPostal,
        cityName: originCity,
        countryCode: originCountry,
      },
      receiverDetails: {
        postalCode:
          process.env.DHL_EXPRESS_DEST_POSTAL?.trim() || originPostal,
        cityName: ctx.request.destinationDistrict || ctx.request.destinationProvince,
        countryCode: destCountry,
        provinceCode: ctx.request.destinationProvince,
      },
    },
    accounts: [{ typeCode: "shipper", number: account }],
    plannedShippingDateAndTime: plannedShippingIso(),
    unitOfMeasurement: "metric",
    isCustomsDeclarable: originCountry !== destCountry,
    packages: [
      {
        weight,
        dimensions: {
          length: Number(process.env.DHL_EXPRESS_PKG_LENGTH || 30),
          width: Number(process.env.DHL_EXPRESS_PKG_WIDTH || 20),
          height: Number(process.env.DHL_EXPRESS_PKG_HEIGHT || 15),
        },
      },
    ],
  };

  const url = `${dhlBaseUrl()}/rates`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error("[logistics] DHL rates network error", error);
    return null;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(
      "[logistics] DHL rates HTTP",
      res.status,
      text.slice(0, 300),
    );
    return null;
  }

  const data = (await res.json()) as {
    products?: DhlRateProduct[];
  };
  const products = data.products || [];
  if (products.length === 0) return null;

  // Prefer cheapest MZN/USD product with a price.
  let best: { cents: number; name: string; days?: number } | null = null;
  for (const p of products) {
    const priceRow =
      p.totalPrice?.find((x) => x.priceCurrency === "MZN") ||
      p.totalPrice?.find((x) => x.priceCurrency === "USD") ||
      p.totalPrice?.[0];
    if (priceRow?.price == null || !Number.isFinite(priceRow.price)) continue;
    // MyDHL returns major units; convert to cents.
    const cents = Math.round(Number(priceRow.price) * 100);
    if (cents <= 0) continue;
    const days = p.deliveryCapabilities?.totalTransitDays;
    if (!best || cents < best.cents) {
      best = {
        cents,
        name: p.productName || p.productCode || "DHL Express",
        days: typeof days === "number" ? days : undefined,
      };
    }
  }
  if (!best) return null;

  return {
    method: "EXPRESS",
    carrierCode: CarrierCode.DHL_EXPRESS,
    label: `DHL Express · ${best.name}`,
    amountCents: best.cents,
    etaDaysMin: best.days ?? 2,
    etaDaysMax: best.days != null ? best.days + 2 : 7,
  };
}

export const dhlExpressAdapter: CarrierAdapter = {
  code: CarrierCode.DHL_EXPRESS,
  name: "DHL Express",
  method: "EXPRESS",
  async quote(ctx: QuoteContext) {
    if (!isDhlExpressConfigured()) return null;
    return fetchDhlRates(ctx);
  },
  resolveTrackingCode({ orderNumber, sellerTrackingCode }) {
    const code = sellerTrackingCode?.trim();
    if (code) return code;
    return `DHL-${orderNumber}`;
  },
};
