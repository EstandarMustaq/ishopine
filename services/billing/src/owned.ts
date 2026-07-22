/**
 * Phase 15: billing owns pricing + subscriptions + usage/invoices when BILLING_OWNED≠0.
 * PaySuite (/api/billing/paysuite*, legacy stripe/mpesa) falls through to Nest/payments.
 * Internal: POST /api/billing/internal/record-usage (settle from Nest).
 */
import http from "node:http";
import {
  PlatformRole,
  PricingPlanCode,
  Prisma,
  PrismaClient,
  SubscriptionStatus,
  TenantType,
  UsageMetric,
} from "@prisma/client";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME, TENANT_HEADER } from "@ishopine/shared";

const prisma = new PrismaClient();
const jwtSecret = process.env.JWT_SECRET || "";
const internalSecret =
  process.env.INTERNAL_SERVICE_SECRET || process.env.CRON_SECRET || "";

type JwtPayload = { sub: string; platformRole?: PlatformRole };

type TenantCtx = {
  tenantId: string;
  tenantType: TenantType;
  tenantSlug: string;
  membershipRole: string;
  shopId: string | null;
  accountId: string;
};

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const DEFAULT_PLANS: Array<{
  code: PricingPlanCode;
  name: string;
  description: string;
  monthlyPriceCents: number;
  includedOrders: number | null;
  overageOrderCents: number;
  commissionBps: number | null;
  sortOrder: number;
  features: Prisma.InputJsonValue;
}> = [
  {
    code: PricingPlanCode.FREE,
    name: "Free",
    description: "Começar a vender no iShopine",
    monthlyPriceCents: 0,
    includedOrders: 20,
    overageOrderCents: 500,
    commissionBps: 800,
    sortOrder: 0,
    features: { storeCategories: false, ads: false },
  },
  {
    code: PricingPlanCode.STARTER,
    name: "Starter",
    description: "Para particulares e micro-lojas",
    monthlyPriceCents: 49900,
    includedOrders: 100,
    overageOrderCents: 300,
    commissionBps: 600,
    sortOrder: 1,
    features: { storeCategories: true, ads: false },
  },
  {
    code: PricingPlanCode.BUSINESS,
    name: "Business",
    description: "Para lojas em crescimento",
    monthlyPriceCents: 149900,
    includedOrders: 500,
    overageOrderCents: 150,
    commissionBps: 500,
    sortOrder: 2,
    features: { storeCategories: true, ads: true },
  },
  {
    code: PricingPlanCode.ENTERPRISE,
    name: "Enterprise",
    description: "Volume alto e suporte dedicado",
    monthlyPriceCents: 0,
    includedOrders: null,
    overageOrderCents: 0,
    commissionBps: 350,
    sortOrder: 3,
    features: { storeCategories: true, ads: true, sla: true },
  },
];

let plansEnsured = false;

function periodKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addMonths(d: Date, months: number) {
  const next = new Date(d);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${name}=`)) continue;
    return decodeURIComponent(trimmed.slice(name.length + 1));
  }
  return null;
}

function extractToken(req: http.IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return parseCookie(req.headers.cookie, AUTH_COOKIE_NAME);
}

function verifyJwt(req: http.IncomingMessage): JwtPayload | null {
  const token = extractToken(req);
  if (!token || !jwtSecret) return null;
  try {
    return jwt.verify(token, jwtSecret) as JwtPayload;
  } catch {
    return null;
  }
}

function verifyInternal(req: http.IncomingMessage): boolean {
  if (!internalSecret) return false;
  const auth = req.headers.authorization;
  if (!auth?.toLowerCase().startsWith("bearer ")) return false;
  return auth.slice(7).trim() === internalSecret;
}

function pathOnly(url?: string) {
  return (url || "/").split("?")[0];
}

function queryParam(url: string | undefined, key: string): string | undefined {
  const q = (url || "").split("?")[1];
  if (!q) return undefined;
  const params = new URLSearchParams(q);
  return params.get(key) ?? undefined;
}

function headerValue(
  req: http.IncomingMessage,
  name: string,
): string | undefined {
  const raw = req.headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  const errorName =
    status === 401
      ? "Unauthorized"
      : status === 403
        ? "Forbidden"
        : status === 404
          ? "Not Found"
          : status === 400
            ? "Bad Request"
            : "Error";
  const payload =
    status >= 400 && typeof body === "string"
      ? { statusCode: status, message: body, error: errorName }
      : body;
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        resolve(
          parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : {},
        );
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function ensureDefaultPlans() {
  if (plansEnsured) return;
  for (const plan of DEFAULT_PLANS) {
    await prisma.pricingPlan.upsert({
      where: { code: plan.code },
      create: {
        code: plan.code,
        name: plan.name,
        description: plan.description,
        monthlyPriceCents: plan.monthlyPriceCents,
        includedOrders: plan.includedOrders,
        overageOrderCents: plan.overageOrderCents,
        commissionBps: plan.commissionBps,
        sortOrder: plan.sortOrder,
        features: plan.features,
      },
      update: {
        name: plan.name,
        description: plan.description,
        monthlyPriceCents: plan.monthlyPriceCents,
        includedOrders: plan.includedOrders,
        overageOrderCents: plan.overageOrderCents,
        commissionBps: plan.commissionBps,
        sortOrder: plan.sortOrder,
        features: plan.features,
        isActive: true,
      },
    });
  }
  plansEnsured = true;
}

async function ensureAccountForUser(userId: string) {
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

async function resolveTenantAccess(
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
    accountId,
  };
}

async function requireUser(req: http.IncomingMessage): Promise<{
  jwt: JwtPayload;
  userId: string;
  platformRole: PlatformRole | null;
}> {
  const payload = verifyJwt(req);
  if (!payload?.sub) throw new HttpError(401, "Não autenticado");
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, platformRole: true },
  });
  if (!user) throw new HttpError(401, "Não autenticado");
  return {
    jwt: payload,
    userId: user.id,
    platformRole: user.platformRole,
  };
}

async function requireSellerTenant(
  req: http.IncomingMessage,
): Promise<{ userId: string; tenant: TenantCtx }> {
  const { userId, platformRole } = await requireUser(req);
  const tenantId = headerValue(req, TENANT_HEADER);
  const isStaff =
    platformRole === PlatformRole.PLATFORM_ADMIN ||
    platformRole === PlatformRole.PLATFORM_OPERATOR;

  if (!tenantId) {
    if (isStaff) {
      throw new HttpError(400, "Tenant em falta para esta operação");
    }
    throw new HttpError(
      403,
      `Cabeçalho ${TENANT_HEADER} é obrigatório neste recurso`,
    );
  }

  const account = await ensureAccountForUser(userId);
  const tenant = await resolveTenantAccess(account.id, tenantId);
  if (
    tenant.tenantType !== TenantType.PARTICULAR &&
    tenant.tenantType !== TenantType.STORE
  ) {
    throw new HttpError(
      403,
      "Este recurso só aceita tenant: PARTICULAR, STORE",
    );
  }
  return { userId, tenant };
}

async function getActiveForTenant(tenantId: string) {
  return prisma.subscription.findFirst({
    where: {
      tenantId,
      status: {
        in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
      },
    },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
}

async function ensureFreeSubscription(tenantId: string, accountId: string) {
  const existing = await getActiveForTenant(tenantId);
  if (existing) return existing;
  await ensureDefaultPlans();
  const free = await prisma.pricingPlan.findUnique({
    where: { code: PricingPlanCode.FREE },
  });
  if (!free) throw new HttpError(404, "Plano FREE em falta");
  const start = new Date();
  return prisma.subscription.create({
    data: {
      planId: free.id,
      tenantId,
      accountId,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: start,
      currentPeriodEnd: addMonths(start, 1),
    },
    include: { plan: true },
  });
}

async function ensureActiveOrFree(tenantId: string) {
  const active = await getActiveForTenant(tenantId);
  if (active) return active;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new HttpError(404, "Tenant não encontrado");
  return ensureFreeSubscription(tenantId, tenant.ownerAccountId);
}

async function subscribeTenant(
  userId: string,
  tenantId: string,
  planCode: PricingPlanCode,
) {
  const account = await ensureAccountForUser(userId);
  await resolveTenantAccess(account.id, tenantId);
  await ensureDefaultPlans();

  const plan = await prisma.pricingPlan.findUnique({ where: { code: planCode } });
  if (!plan?.isActive) throw new HttpError(404, "Plano inválido");

  const active = await getActiveForTenant(tenantId);
  if (active) {
    await prisma.subscription.update({
      where: { id: active.id },
      data: { status: SubscriptionStatus.CANCELLED, cancelAtPeriodEnd: true },
    });
  }

  const start = new Date();
  return prisma.subscription.create({
    data: {
      planId: plan.id,
      tenantId,
      accountId: account.id,
      status:
        plan.monthlyPriceCents === 0
          ? SubscriptionStatus.ACTIVE
          : SubscriptionStatus.TRIALING,
      currentPeriodStart: start,
      currentPeriodEnd: addMonths(start, 1),
    },
    include: { plan: true },
  });
}

/** Idempotent when `reference` is set (order settle). */
export async function recordUsage(input: {
  tenantId: string;
  metric: UsageMetric;
  quantity?: number;
  reference?: string;
}) {
  if (input.reference) {
    const existing = await prisma.usageRecord.findFirst({
      where: {
        tenantId: input.tenantId,
        metric: input.metric,
        reference: input.reference,
      },
    });
    if (existing) return existing;
  }

  return prisma.usageRecord.create({
    data: {
      tenantId: input.tenantId,
      metric: input.metric,
      quantity: input.quantity ?? 1,
      periodKey: periodKey(),
      reference: input.reference,
    },
  });
}

async function usageSummary(tenantId: string, period?: string) {
  const key = period || periodKey();
  const rows = await prisma.usageRecord.groupBy({
    by: ["metric"],
    where: { tenantId, periodKey: key },
    _sum: { quantity: true },
  });
  const sub = await ensureActiveOrFree(tenantId);
  return {
    periodKey: key,
    subscription: sub,
    usage: rows.map((r) => ({
      metric: r.metric,
      quantity: r._sum.quantity ?? 0,
    })),
  };
}

async function generateInvoice(tenantId: string, period?: string) {
  const key = period || periodKey();
  const sub = await getActiveForTenant(tenantId);
  if (!sub) {
    throw new HttpError(400, "Tenant sem subscrição activa");
  }

  const existing = await prisma.platformInvoice.findFirst({
    where: { tenantId, periodKey: key, status: { not: "VOID" } },
  });
  if (existing) return existing;

  const ordersUsed = await prisma.usageRecord.aggregate({
    where: {
      tenantId,
      periodKey: key,
      metric: UsageMetric.ORDERS,
    },
    _sum: { quantity: true },
  });
  const orderCount = ordersUsed._sum.quantity ?? 0;
  const included = sub.plan.includedOrders;
  const overage = included == null ? 0 : Math.max(0, orderCount - included);
  const overageCents = overage * (sub.plan.overageOrderCents ?? 0);
  const subscriptionCents = sub.plan.monthlyPriceCents;
  const subtotalCents = subscriptionCents + overageCents;

  const lineItems = [
    {
      type: "subscription",
      plan: sub.plan.code,
      amountCents: subscriptionCents,
    },
    ...(overage > 0
      ? [
          {
            type: "overage_orders",
            quantity: overage,
            unitCents: sub.plan.overageOrderCents,
            amountCents: overageCents,
          },
        ]
      : []),
  ];

  return prisma.platformInvoice.create({
    data: {
      tenantId,
      accountId: sub.accountId,
      periodKey: key,
      status: "DRAFT",
      subtotalCents,
      totalCents: subtotalCents,
      lineItems,
      dueAt: addMonths(new Date(), 0),
    },
  });
}

function listInvoices(tenantId: string) {
  return prisma.platformInvoice.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 24,
  });
}

function listPayments(buyerId: string) {
  return prisma.billingPayment.findMany({
    where: { buyerId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

function isPaysuiteOrLegacy(path: string): boolean {
  return (
    path.startsWith("/api/billing/paysuite") ||
    path.startsWith("/api/billing/stripe") ||
    path.startsWith("/api/billing/mpesa")
  );
}

const PLAN_CODES = new Set<string>(Object.values(PricingPlanCode));
const METRICS = new Set<string>(Object.values(UsageMetric));

export async function handleOwnedBilling(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const path = pathOnly(req.url);
  const method = (req.method || "GET").toUpperCase();

  if (isPaysuiteOrLegacy(path)) {
    return false;
  }

  const ownedPrefix =
    path.startsWith("/api/pricing") ||
    path.startsWith("/api/subscriptions") ||
    path.startsWith("/api/billing");
  if (!ownedPrefix) {
    return false;
  }

  try {
    if (
      method === "POST" &&
      path === "/api/billing/internal/record-usage"
    ) {
      if (!verifyInternal(req)) {
        json(res, 401, "Segredo interno inválido");
        return true;
      }
      const body = await readJsonBody(req);
      const tenantId =
        typeof body.tenantId === "string" ? body.tenantId : "";
      const metric =
        typeof body.metric === "string" ? body.metric : UsageMetric.ORDERS;
      if (!tenantId) {
        json(res, 400, "tenantId obrigatório");
        return true;
      }
      if (!METRICS.has(metric)) {
        json(res, 400, "metric inválido");
        return true;
      }
      const quantity =
        typeof body.quantity === "number"
          ? body.quantity
          : Number(body.quantity ?? 1);
      const reference =
        typeof body.reference === "string" ? body.reference : undefined;
      const row = await recordUsage({
        tenantId,
        metric: metric as UsageMetric,
        quantity: Number.isFinite(quantity) ? quantity : 1,
        reference,
      });
      json(res, 200, row);
      return true;
    }

    if (method === "GET" && path === "/api/pricing/plans") {
      await ensureDefaultPlans();
      const plans = await prisma.pricingPlan.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      });
      json(res, 200, plans);
      return true;
    }

    if (method === "GET" && path === "/api/subscriptions/me") {
      const { userId, platformRole } = await requireUser(req);
      const tenantId = headerValue(req, TENANT_HEADER);
      if (!tenantId) {
        const isStaff =
          platformRole === PlatformRole.PLATFORM_ADMIN ||
          platformRole === PlatformRole.PLATFORM_OPERATOR;
        if (isStaff) {
          json(res, 200, { subscription: null });
          return true;
        }
        throw new HttpError(
          403,
          `Cabeçalho ${TENANT_HEADER} é obrigatório neste recurso`,
        );
      }
      const account = await ensureAccountForUser(userId);
      const tenant = await resolveTenantAccess(account.id, tenantId);
      const subscription = await ensureActiveOrFree(tenant.tenantId);
      json(res, 200, { subscription });
      return true;
    }

    if (method === "POST" && path === "/api/subscriptions") {
      const { userId, tenant } = await requireSellerTenant(req);
      const body = await readJsonBody(req);
      const planCode =
        typeof body.planCode === "string" ? body.planCode : "";
      if (!PLAN_CODES.has(planCode)) {
        throw new HttpError(400, "planCode inválido");
      }
      const sub = await subscribeTenant(
        userId,
        tenant.tenantId,
        planCode as PricingPlanCode,
      );
      json(res, 201, sub);
      return true;
    }

    if (method === "GET" && path === "/api/billing/usage") {
      const { tenant } = await requireSellerTenant(req);
      const period = queryParam(req.url, "period");
      json(res, 200, await usageSummary(tenant.tenantId, period));
      return true;
    }

    if (method === "POST" && path === "/api/billing/invoices/generate") {
      const { tenant } = await requireSellerTenant(req);
      const body = await readJsonBody(req);
      const period =
        typeof body.period === "string" ? body.period : undefined;
      json(res, 201, await generateInvoice(tenant.tenantId, period));
      return true;
    }

    if (method === "GET" && path === "/api/billing/invoices") {
      const { tenant } = await requireSellerTenant(req);
      json(res, 200, await listInvoices(tenant.tenantId));
      return true;
    }

    if (method === "GET" && path === "/api/billing/payments") {
      const { userId } = await requireUser(req);
      json(res, 200, await listPayments(userId));
      return true;
    }

    // Unknown /api/billing|pricing|subscriptions → Nest fallthrough.
    return false;
  } catch (error) {
    if (error instanceof HttpError) {
      json(res, error.status, error.message);
      return true;
    }
    if (error instanceof SyntaxError) {
      json(res, 400, "JSON inválido");
      return true;
    }
    console.error("[billing] owned error", error);
    json(res, 500, "Erro interno de billing");
    return true;
  }
}
