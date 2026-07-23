/**
 * Phase 20–23: logistics core — zones, adapters, shipments, HMAC webhooks.
 * Phase 23: fail-closed DHL Express MyDHL; Correios MZ still maps → MANUAL.
 * Phase 29: Correios OpenAPI gate (docs/contracts/) — no invented HTTP.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  CarrierCode,
  Prisma,
  PrismaClient,
  ShipmentStatus,
  TenantMemberRole,
  TenantType,
} from "@prisma/client";
import type { ShippingQuote, ShippingQuoteRequest } from "@ishopine/shared";
import { isDhlExpressConfigured } from "./carriers/dhl-express.adapter";
import { getCarrierAdapter, listCarrierAdapters } from "./carriers/registry";
import type { ZoneRate } from "./carriers/types";
import { HttpError } from "./http-error";

export const prisma = new PrismaClient();

export type TenantCtx = {
  tenantId: string;
  tenantType: TenantType;
  tenantSlug: string;
  membershipRole: TenantMemberRole;
  shopId: string | null;
};

const WEBHOOK_STATUSES = new Set<ShipmentStatus>([
  ShipmentStatus.LABEL_CREATED,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.OUT_FOR_DELIVERY,
  ShipmentStatus.DELIVERED,
  ShipmentStatus.CANCELLED,
  ShipmentStatus.RETURNED,
]);

const orgSlug = process.env.PLATFORM_ORG_SLUG || "ishopine";

export function listCarriers() {
  return listCarrierAdapters().map((a) => ({
    code: a.code,
    name: a.name,
    method: a.method,
    live:
      a.code === CarrierCode.DHL_EXPRESS ? isDhlExpressConfigured() : false,
  }));
}

/**
 * Phase 23–29: Correios MZ stays unavailable until a real OpenAPI/contract
 * lands in-repo and an adapter is generated from it — never invent HTTP.
 */
export function correiosMzOpenApiPath() {
  const fromEnv = (process.env.CORREIOS_MZ_OPENAPI_PATH || "").trim();
  if (fromEnv) return resolve(fromEnv);
  const candidates = [
    resolve(process.cwd(), "docs/contracts/correios-mz.openapi.yaml"),
    resolve(process.cwd(), "../../docs/contracts/correios-mz.openapi.yaml"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

export function correiosMzContractStatus() {
  const base = (process.env.CORREIOS_MZ_API_BASE || "").trim();
  const key = (process.env.CORREIOS_MZ_API_KEY || "").trim();
  const secret = (process.env.CORREIOS_MZ_API_SECRET || "").trim();
  const contractedFlag = process.env.CORREIOS_MZ_CONTRACTED === "1";
  const envPresent = Boolean(base && key && secret);
  const openApiPath = correiosMzOpenApiPath();
  const openapiPresent = existsSync(openApiPath);
  /** Adapter ships only after OpenAPI lands — none in repo yet. */
  const adapterPresent = false;
  return {
    contractedFlag,
    envPresent,
    openapiPresent,
    openApiPath,
    adapterPresent,
    /**
     * Live HTTP only when: contracted + OpenAPI file + credentials + adapter.
     * Never invent rates/clients.
     */
    live: false,
    readyForAdapter: contractedFlag && openapiPresent && envPresent,
    env: [
      "CORREIOS_MZ_CONTRACTED",
      "CORREIOS_MZ_API_BASE",
      "CORREIOS_MZ_API_KEY",
      "CORREIOS_MZ_API_SECRET",
      "CORREIOS_MZ_OPENAPI_PATH",
    ],
  };
}

export function listCarrierPartners() {
  const correios = correiosMzContractStatus();
  let reason: string;
  if (!correios.openapiPresent) {
    reason =
      "Sem OpenAPI/contrato em docs/contracts/correios-mz.openapi.yaml — HTTP bloqueado; mapsTo MANUAL";
  } else if (!correios.adapterPresent) {
    reason =
      "OpenAPI presente, mas adapter HTTP ainda não gerado a partir do contrato — mapsTo MANUAL";
  } else if (!correios.envPresent) {
    reason = "OpenAPI+adapter presentes, mas credenciais CORREIOS_MZ_* em falta";
  } else if (!correios.contractedFlag) {
    reason = "Definir CORREIOS_MZ_CONTRACTED=1 após contrato assinado";
  } else {
    reason = "Contrato completo — ativar live no adapter";
  }
  return {
    local: listCarrierAdapters()
      .filter((a) => a.code !== CarrierCode.DHL_EXPRESS)
      .map((a) => ({
        code: a.code,
        name: a.name,
        method: a.method,
        mode: "local" as const,
      })),
    live: [
      {
        code: "DHL_EXPRESS",
        name: "DHL Express (MyDHL API)",
        configured: isDhlExpressConfigured(),
        mode: "http" as const,
        docs: "https://developer.dhl.com/api-reference/dhl-express-mydhl-api",
        env: [
          "DHL_EXPRESS_API_KEY",
          "DHL_EXPRESS_API_SECRET",
          "DHL_EXPRESS_ACCOUNT_NUMBER",
        ],
      },
      {
        code: "CORREIOS_MZ",
        name: "Correios de Moçambique",
        configured: false,
        mode: "unavailable" as const,
        contractedFlag: correios.contractedFlag,
        credentialsPresent: correios.envPresent,
        openapiPresent: correios.openapiPresent,
        openApiPath: correios.openApiPath,
        adapterPresent: correios.adapterPresent,
        readyForAdapter: correios.readyForAdapter,
        reason,
        mapsTo: "MANUAL",
        env: correios.env,
      },
    ],
  };
}

async function platformShipping() {
  const settings = await prisma.platformSettings.findFirst({
    where: { organization: { slug: orgSlug } },
  });
  return {
    flatCents: settings?.shippingFlatCents ?? 4900,
    freeAtCents: settings?.freeShippingCents ?? 99900,
  };
}

/** Weight surcharge: +500c per kg above 2kg. */
function weightSurchargeCents(weightKg?: number) {
  if (weightKg == null || weightKg <= 2) return 0;
  return Math.ceil(weightKg - 2) * 500;
}

function normalizeGeo(value?: string | null) {
  return (value ?? "").trim().toLowerCase() || null;
}

/**
 * Resolve rate zone: city+province → province → national (null/null).
 */
export async function resolveZone(
  carrierCode: CarrierCode,
  province: string,
  city?: string,
  weightKg?: number,
): Promise<ZoneRate | null> {
  const weightGrams =
    weightKg != null && Number.isFinite(weightKg)
      ? Math.round(weightKg * 1000)
      : null;

  const zones = await prisma.shippingRateZone.findMany({
    where: { carrierCode, active: true },
    orderBy: { sortOrder: "asc" },
  });
  if (zones.length === 0) return null;

  const p = normalizeGeo(province);
  const c = normalizeGeo(city);

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
        normalizeGeo(z.province) === p &&
        c != null &&
        normalizeGeo(z.city) === c,
    ) ||
    pick(
      (z) =>
        normalizeGeo(z.province) === p &&
        (z.city == null || z.city === ""),
    ) ||
    pick((z) => z.province == null && z.city == null)
  );
}

export async function quote(
  input: ShippingQuoteRequest,
): Promise<ShippingQuote[]> {
  const platform = await platformShipping();
  const surcharge = weightSurchargeCents(input.weightKg);
  const quotes: ShippingQuote[] = [];

  for (const adapter of listCarrierAdapters()) {
    const zone = await resolveZone(
      adapter.code as CarrierCode,
      input.destinationProvince,
      input.destinationDistrict,
      input.weightKg,
    );
    const q = await adapter.quote({
      request: input,
      zone,
      platform,
      weightSurchargeCents: surcharge,
    });
    if (q) quotes.push(q);
  }

  await prisma.outboxMessage.create({
    data: {
      aggregateType: "shipping",
      aggregateId: input.shopId || input.tenantId || "platform",
      eventType: "shipping.quote.requested",
      payload: {
        destinationProvince: input.destinationProvince,
        destinationDistrict: input.destinationDistrict,
        subtotalCents: input.subtotalCents,
        quoteCount: quotes.length,
      },
    },
  });

  return quotes;
}

export async function createLabel(orderId: string, trackingCode?: string) {
  const shipment = await prisma.shipment.findFirst({
    where: { orderId, status: { not: ShipmentStatus.CANCELLED } },
    orderBy: { createdAt: "desc" },
    include: {
      order: { select: { orderNumber: true } },
    },
  });
  if (!shipment) {
    throw new HttpError(404, "Envio não encontrado para este pedido");
  }

  const adapter = getCarrierAdapter(shipment.carrierCode);
  const code = adapter.resolveTrackingCode({
    orderNumber: shipment.order.orderNumber,
    sellerTrackingCode: trackingCode,
  });

  const updated = await prisma.shipment.update({
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
    include: { events: { orderBy: { createdAt: "desc" }, take: 10 } },
  });

  await prisma.outboxMessage.create({
    data: {
      aggregateType: "shipment",
      aggregateId: updated.id,
      eventType: "shipping.label.created",
      payload: {
        shipmentId: updated.id,
        orderId,
        carrierCode: updated.carrierCode,
        trackingCode: updated.trackingCode,
      },
    },
  });

  return updated;
}

async function advanceStatus(
  shipmentId: string,
  status: ShipmentStatus,
  note: string,
  rawPayload?: Prisma.InputJsonValue,
) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
  });
  if (!shipment) throw new HttpError(404, "Envio não encontrado");
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
  return prisma.shipment.update({
    where: { id: shipmentId },
    data,
    include: { events: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
}

export async function markInTransit(shipmentId: string) {
  return advanceStatus(shipmentId, ShipmentStatus.IN_TRANSIT, "Em trânsito");
}

export async function markDelivered(shipmentId: string) {
  const updated = await advanceStatus(
    shipmentId,
    ShipmentStatus.DELIVERED,
    "Entregue",
  );
  await prisma.shipment.update({
    where: { id: shipmentId },
    data: { deliveredAt: new Date() },
  });
  return updated;
}

/** Phase 25: internal — find shipment by orderId then mark delivered. */
export async function markDeliveredForOrder(orderId: string) {
  const shipment = await prisma.shipment.findFirst({
    where: { orderId, status: { not: ShipmentStatus.CANCELLED } },
    orderBy: { createdAt: "desc" },
  });
  if (!shipment) {
    throw new HttpError(404, "Envio não encontrado para este pedido");
  }
  return markDelivered(shipment.id);
}

export function listShipments(opts: {
  shopId?: string;
  orderId?: string;
  take?: number;
}) {
  return prisma.shipment.findMany({
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
      events: { orderBy: { createdAt: "desc" }, take: 5 },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(100, Math.max(1, opts.take ?? 40)),
  });
}

export function getShipment(id: string) {
  return prisma.shipment.findUnique({
    where: { id },
    include: {
      order: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Printable HTML shipping label (A6-ish). */
export async function renderLabelHtml(id: string): Promise<string> {
  const shipment = await getShipment(id);
  if (!shipment) throw new HttpError(404, "Envio não encontrado");
  const adapter = getCarrierAdapter(shipment.carrierCode);
  const order = shipment.order;
  const tracking = shipment.trackingCode ?? "—";
  const dest = [shipment.destinationDistrict, shipment.destinationProvince]
    .filter(Boolean)
    .join(", ");
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
      <div class="value">${escapeHtml(dest || "—")}</div>
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

export function verifyCarrierWebhookSignature(
  rawBody: string,
  signatureHeader?: string,
) {
  const secret = process.env.CARRIER_WEBHOOK_SECRET;
  if (!secret) {
    throw new HttpError(401, "CARRIER_WEBHOOK_SECRET não configurado");
  }
  if (!signatureHeader) {
    throw new HttpError(401, "Assinatura em falta");
  }
  const provided = signatureHeader.replace(/^sha256=/i, "").trim();
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HttpError(401, "Assinatura inválida");
  }
}

export function parseCarrierCode(value?: string): CarrierCode {
  if (!value) return CarrierCode.FLAT_RATE;
  // Legacy Phase 7 mock — map to MANUAL (no fake Correios).
  if (value === "CORREIOS_MZ") return CarrierCode.MANUAL;
  if (Object.values(CarrierCode).includes(value as CarrierCode)) {
    return value as CarrierCode;
  }
  throw new HttpError(400, `Carrier inválido: ${value}`);
}

export async function handleCarrierWebhook(
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
  verifyCarrierWebhookSignature(rawBody, signatureHeader);

  const carrierCode = parseCarrierCode(carrierParam.toUpperCase());
  const statusRaw = (body.status || "").toUpperCase();
  if (!WEBHOOK_STATUSES.has(statusRaw as ShipmentStatus)) {
    throw new HttpError(400, `Status inválido: ${body.status}`);
  }
  const status = statusRaw as ShipmentStatus;

  const shipment = body.shipmentId
    ? await prisma.shipment.findUnique({ where: { id: body.shipmentId } })
    : body.trackingCode
      ? await prisma.shipment.findFirst({
          where: {
            trackingCode: body.trackingCode,
            carrierCode,
            status: { not: ShipmentStatus.CANCELLED },
          },
          orderBy: { createdAt: "desc" },
        })
      : null;

  if (!shipment) {
    throw new HttpError(404, "Envio não encontrado para o webhook");
  }
  if (shipment.carrierCode !== carrierCode) {
    throw new HttpError(400, "Carrier do webhook não coincide");
  }

  const updated = await advanceStatus(
    shipment.id,
    status,
    body.note || `Webhook ${carrierCode}`,
    body as unknown as Prisma.InputJsonValue,
  );

  await prisma.outboxMessage.create({
    data: {
      aggregateType: "shipment",
      aggregateId: shipment.id,
      eventType: "shipping.status.updated",
      payload: {
        shipmentId: shipment.id,
        orderId: shipment.orderId,
        carrierCode,
        status,
        trackingCode: shipment.trackingCode,
      },
    },
  });

  return updated;
}

export async function ensureAccountForUser(userId: string) {
  const existing = await prisma.account.findUnique({ where: { userId } });
  if (existing) return existing;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, "Utilizador não encontrado");
  return prisma.account.create({
    data: {
      userId: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
    },
  });
}

export async function resolveTenantAccess(
  accountId: string,
  tenantId: string,
): Promise<TenantCtx> {
  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_accountId: { tenantId, accountId } },
    include: { tenant: true },
  });
  if (!membership?.isActive || !membership.tenant.isActive) {
    throw new HttpError(403, "Sem acesso a este tenant");
  }
  return {
    tenantId: membership.tenant.id,
    tenantType: membership.tenant.type,
    tenantSlug: membership.tenant.slug,
    membershipRole: membership.role,
    shopId: membership.tenant.shopId,
  };
}

export { HttpError };
