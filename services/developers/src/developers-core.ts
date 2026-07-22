/**
 * Phase 19: developers platform — API keys, webhooks, v1 Commerce API, feature flags.
 */
import { createHash, createHmac, randomBytes } from "node:crypto";
import {
  PricingPlanCode,
  PrismaClient,
  TenantMemberRole,
  TenantType,
  UsageMetric,
} from "@prisma/client";

export const prisma = new PrismaClient();

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export type TenantCtx = {
  tenantId: string;
  tenantType: TenantType;
  tenantSlug: string;
  membershipRole: TenantMemberRole;
  shopId: string | null;
};

export type ApiKeyContext = {
  tenantId: string;
  accountId: string;
  shopId: string | null;
  apiKeyId: string;
};

const DEFAULT_FLAGS: Array<{
  key: string;
  description: string;
  enabled: boolean;
}> = [
  {
    key: "developer_platform",
    description: "API keys e webhooks para merchants",
    enabled: true,
  },
  {
    key: "store_hours_policies",
    description: "Horários e políticas na ficha da loja",
    enabled: true,
  },
  {
    key: "media_tenant_scope",
    description: "Uploads scoped por tenant",
    enabled: true,
  },
];

let flagsEnsured = false;

function hashKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

function periodKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function ensureDefaultFlags() {
  if (flagsEnsured) return;
  for (const flag of DEFAULT_FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      create: flag,
      update: { description: flag.description },
    });
  }
  flagsEnsured = true;
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

export async function createApiKey(
  userId: string,
  tenantId: string,
  name: string,
) {
  const account = await ensureAccountForUser(userId);
  await resolveTenantAccess(account.id, tenantId);

  const secret = randomBytes(24).toString("base64url");
  const raw = `ish_live_${secret}`;
  const keyPrefix = raw.slice(0, 16);
  const keyHash = hashKey(raw);

  const record = await prisma.merchantApiKey.create({
    data: {
      tenantId,
      accountId: account.id,
      name: name.trim() || "Default",
      keyPrefix,
      keyHash,
    },
  });

  return {
    id: record.id,
    name: record.name,
    keyPrefix: record.keyPrefix,
    createdAt: record.createdAt,
    apiKey: raw,
  };
}

export function listApiKeys(tenantId: string) {
  return prisma.merchantApiKey.findMany({
    where: { tenantId, revokedAt: null },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeApiKey(
  userId: string,
  tenantId: string,
  keyId: string,
) {
  const account = await ensureAccountForUser(userId);
  await resolveTenantAccess(account.id, tenantId);
  const key = await prisma.merchantApiKey.findFirst({
    where: { id: keyId, tenantId },
  });
  if (!key) throw new HttpError(404, "API key não encontrada");
  return prisma.merchantApiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
  });
}

export async function authenticateApiKey(rawKey: string): Promise<ApiKeyContext> {
  if (!rawKey?.startsWith("ish_live_")) {
    throw new HttpError(401, "API key inválida");
  }
  const keyHash = hashKey(rawKey);
  const key = await prisma.merchantApiKey.findFirst({
    where: { keyHash, revokedAt: null },
    include: { tenant: true },
  });
  if (!key || !key.tenant.isActive) {
    throw new HttpError(401, "API key inválida ou revogada");
  }
  await prisma.merchantApiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  });
  await prisma.usageRecord.create({
    data: {
      tenantId: key.tenantId,
      metric: UsageMetric.API_CALLS,
      quantity: 1,
      periodKey: periodKey(),
      reference: key.id,
    },
  });
  return {
    tenantId: key.tenantId,
    accountId: key.accountId,
    shopId: key.tenant.shopId,
    apiKeyId: key.id,
  };
}

export async function upsertWebhook(
  userId: string,
  tenantId: string,
  input: { url: string; events?: string[] },
) {
  const account = await ensureAccountForUser(userId);
  await resolveTenantAccess(account.id, tenantId);

  let url: URL;
  try {
    url = new URL(input.url);
  } catch {
    throw new HttpError(400, "URL de webhook inválida");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new HttpError(400, "Webhook deve ser http(s)");
  }

  const existing = await prisma.merchantWebhookEndpoint.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  const secret =
    existing?.secret ?? `whsec_${randomBytes(24).toString("hex")}`;

  if (existing) {
    return prisma.merchantWebhookEndpoint.update({
      where: { id: existing.id },
      data: {
        url: input.url,
        events: input.events ?? existing.events,
        isActive: true,
      },
    });
  }

  return prisma.merchantWebhookEndpoint.create({
    data: {
      tenantId,
      accountId: account.id,
      url: input.url,
      secret,
      events: input.events ?? [
        "order.created",
        "order.confirmed",
        "commerce.checkout.completed",
      ],
    },
  });
}

export function listWebhooks(tenantId: string) {
  return prisma.merchantWebhookEndpoint.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}

export async function rotateWebhookSecret(
  userId: string,
  tenantId: string,
  endpointId: string,
) {
  const account = await ensureAccountForUser(userId);
  await resolveTenantAccess(account.id, tenantId);
  const endpoint = await prisma.merchantWebhookEndpoint.findFirst({
    where: { id: endpointId, tenantId },
  });
  if (!endpoint) throw new HttpError(404, "Webhook não encontrado");
  return prisma.merchantWebhookEndpoint.update({
    where: { id: endpointId },
    data: { secret: `whsec_${randomBytes(24).toString("hex")}` },
  });
}

export function listV1Products(_tenantId: string, shopId: string | null) {
  if (!shopId) return [];
  return prisma.product.findMany({
    where: { shopId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      priceCents: true,
      stock: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}

export function listV1Orders(_tenantId: string, shopId: string | null) {
  if (!shopId) return [];
  return prisma.order.findMany({
    where: { sellerShopId: shopId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      totalCents: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

/* ── Feature flags ───────────────────────────────────────────── */

export async function listFlags() {
  await ensureDefaultFlags();
  return prisma.featureFlag.findMany({
    include: { overrides: true },
    orderBy: { key: "asc" },
  });
}

export async function setFlagEnabled(key: string, enabled: boolean) {
  await ensureDefaultFlags();
  const flag = await prisma.featureFlag.findUnique({ where: { key } });
  if (!flag) throw new HttpError(404, "Flag não encontrada");
  return prisma.featureFlag.update({
    where: { id: flag.id },
    data: { enabled },
  });
}

export async function setFlagOverride(input: {
  key: string;
  scopeKey: string;
  enabled: boolean;
  tenantId?: string | null;
}) {
  await ensureDefaultFlags();
  const flag = await prisma.featureFlag.findUnique({
    where: { key: input.key },
  });
  if (!flag) throw new HttpError(404, "Flag não encontrada");

  return prisma.featureFlagOverride.upsert({
    where: {
      flagId_scopeKey: { flagId: flag.id, scopeKey: input.scopeKey },
    },
    create: {
      flagId: flag.id,
      scopeKey: input.scopeKey,
      enabled: input.enabled,
      tenantId: input.tenantId ?? null,
    },
    update: {
      enabled: input.enabled,
      tenantId: input.tenantId ?? null,
    },
  });
}

export async function evaluateFlag(input: {
  key: string;
  tenantId?: string | null;
  planCode?: PricingPlanCode | null;
}) {
  await ensureDefaultFlags();
  const flag = await prisma.featureFlag.findUnique({
    where: { key: input.key },
    include: { overrides: true },
  });
  if (!flag) {
    return { key: input.key, enabled: false, source: "missing" as const };
  }

  if (input.planCode) {
    const planScope = `plan:${input.planCode}`;
    const planOverride = flag.overrides.find((o) => o.scopeKey === planScope);
    if (planOverride) {
      return {
        key: input.key,
        enabled: planOverride.enabled,
        source: "plan" as const,
      };
    }
  }

  if (input.tenantId) {
    const tenantScope = `tenant:${input.tenantId}`;
    const tenantOverride = flag.overrides.find(
      (o) => o.scopeKey === tenantScope,
    );
    if (tenantOverride) {
      return {
        key: input.key,
        enabled: tenantOverride.enabled,
        source: "tenant" as const,
      };
    }
  }

  return {
    key: input.key,
    enabled: flag.enabled,
    source: "global" as const,
  };
}

export async function evaluateMany(
  keys: string[],
  ctx: { tenantId?: string | null; planCode?: PricingPlanCode | null },
) {
  const results = await Promise.all(
    keys.map((key) => evaluateFlag({ key, ...ctx })),
  );
  return Object.fromEntries(results.map((r) => [r.key, r]));
}

/** Kept for parity / future signature tests. */
export function signWebhookBody(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export type { PricingPlanCode, TenantType };
