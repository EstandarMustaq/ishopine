/**
 * Phase 29: security compliance / findings (Nest SecurityService parity).
 * Outbox enqueue + projection upsert are local Prisma (tick stays on platform-ops).
 */
import { createHash } from "node:crypto";
import {
  FindingStatus,
  Prisma,
  PrismaClient,
  VulnSeverity,
} from "@prisma/client";
import { HttpError } from "./http-error";
import {
  SECURITY_CATALOG,
  SECURITY_RULES,
  type SecurityCheckContext,
} from "./rules";

export const prisma = new PrismaClient();
export { HttpError };

const OUTBOX_MAX_ATTEMPTS = 8;
const PROJECTION_NAME = "platform_security_sync";

function checksum(data: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex")
    .slice(0, 32);
}

function isPaysuiteEnabled(): boolean {
  const flag = (process.env.PAYSUITE_ENABLED || "1").trim().toLowerCase();
  return !(
    flag === "0" ||
    flag === "false" ||
    flag === "off" ||
    flag === "no"
  );
}

function buildContext(): SecurityCheckContext {
  const nodeEnv = process.env.NODE_ENV || "development";
  const webUrl = process.env.WEB_URL;
  const appUrl = process.env.APP_URL;
  const httpsEnforced =
    Boolean(webUrl?.startsWith("https://")) &&
    Boolean(appUrl?.startsWith("https://"));
  const paysuiteEnabled = isPaysuiteEnabled();

  return {
    nodeEnv,
    jwtSecret: process.env.JWT_SECRET,
    paysuiteEnabled,
    paysuiteToken: process.env.PAYSUITE_TOKEN?.trim(),
    paysuiteWebhookSecret: process.env.PAYSUITE_WEBHOOK_SECRET?.trim(),
    corsOrigin: process.env.CORS_ORIGIN,
    webUrl,
    appUrl,
    httpsEnforced,
  };
}

async function upsertProjection(
  name: string,
  partitionKey: string,
  data: unknown,
) {
  const sum = checksum(data);
  const existing = await prisma.readProjection.findUnique({
    where: { name_partitionKey: { name, partitionKey } },
  });
  if (existing?.checksum === sum) {
    return { projection: existing, changed: false };
  }
  const projection = await prisma.readProjection.upsert({
    where: { name_partitionKey: { name, partitionKey } },
    create: {
      name,
      partitionKey,
      data: data as Prisma.InputJsonValue,
      checksum: sum,
      version: 1,
      projectedAt: new Date(),
    },
    update: {
      data: data as Prisma.InputJsonValue,
      checksum: sum,
      version: { increment: 1 },
      projectedAt: new Date(),
    },
  });
  return { projection, changed: true };
}

async function enqueueOutbox(input: {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
}) {
  return prisma.outboxMessage.create({
    data: {
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      payload: input.payload as Prisma.InputJsonValue,
      status: "PENDING",
      maxAttempts: OUTBOX_MAX_ATTEMPTS,
      availableAt: new Date(),
    },
  });
}

export function complianceSnapshot() {
  return {
    ...SECURITY_RULES.compliance,
    headers: SECURITY_RULES.headers,
    payments: {
      provider: SECURITY_RULES.payments.provider,
      currency: SECURITY_RULES.payments.currency,
      webhookSignatureRequired:
        SECURITY_RULES.payments.webhookSignatureRequired,
    },
    rateLimit: SECURITY_RULES.rateLimit,
    vulnerabilitySla: SECURITY_RULES.vulnerabilitySla,
  };
}

export async function syncSystem() {
  const ctx = buildContext();
  const simulate =
    process.env.PAYSUITE_SIMULATE === "true" && ctx.nodeEnv === "production";

  const results: Array<{
    code: string;
    severity: VulnSeverity;
    ok: boolean;
    status: FindingStatus;
  }> = [];

  for (const entry of SECURITY_CATALOG) {
    let ok = await entry.check(ctx);
    if (entry.code === "SEC-LOW-002") {
      ok = !simulate;
    }

    if (ok) {
      await prisma.securityFinding.upsert({
        where: {
          code_surface: { code: entry.code, surface: entry.surface },
        },
        create: {
          code: entry.code,
          severity: entry.severity,
          title: entry.title,
          description: entry.description,
          surface: entry.surface,
          remediation: entry.remediation,
          status: FindingStatus.CLOSED,
          resolvedAt: new Date(),
          evidence: { ok: true, checkedAt: new Date().toISOString() },
        },
        update: {
          status: FindingStatus.CLOSED,
          resolvedAt: new Date(),
          evidence: { ok: true, checkedAt: new Date().toISOString() },
        },
      });
      results.push({
        code: entry.code,
        severity: entry.severity,
        ok: true,
        status: FindingStatus.CLOSED,
      });
    } else {
      await prisma.securityFinding.upsert({
        where: {
          code_surface: { code: entry.code, surface: entry.surface },
        },
        create: {
          code: entry.code,
          severity: entry.severity,
          title: entry.title,
          description: entry.description,
          surface: entry.surface,
          remediation: entry.remediation,
          status: FindingStatus.OPEN,
          evidence: { ok: false, checkedAt: new Date().toISOString() },
        },
        update: {
          status: FindingStatus.OPEN,
          resolvedAt: null,
          description: entry.description,
          remediation: entry.remediation,
          evidence: { ok: false, checkedAt: new Date().toISOString() },
        },
      });
      results.push({
        code: entry.code,
        severity: entry.severity,
        ok: false,
        status: FindingStatus.OPEN,
      });
      console.warn(
        `[platform-security] OPEN ${entry.severity} ${entry.code}: ${entry.title}`,
      );
    }
  }

  const open = results.filter((r) => !r.ok);
  const summary = {
    checkedAt: new Date().toISOString(),
    total: results.length,
    open: open.length,
    bySeverity: {
      CRITICAL: open.filter((r) => r.severity === VulnSeverity.CRITICAL)
        .length,
      HIGH: open.filter((r) => r.severity === VulnSeverity.HIGH).length,
      MEDIUM: open.filter((r) => r.severity === VulnSeverity.MEDIUM).length,
      LOW: open.filter((r) => r.severity === VulnSeverity.LOW).length,
    },
    shipBlocked: open.some(
      (r) =>
        r.severity === VulnSeverity.HIGH ||
        r.severity === VulnSeverity.CRITICAL,
    ),
    rules: {
      country: SECURITY_RULES.compliance.country,
      currency: SECURITY_RULES.compliance.currency,
      sla: SECURITY_RULES.vulnerabilitySla,
    },
    findings: results,
  };

  await upsertProjection(PROJECTION_NAME, "global", summary);
  await enqueueOutbox({
    aggregateType: "security",
    aggregateId: "global",
    eventType: "security.sync.completed",
    payload: summary,
  });

  return summary;
}

export function listFindings(status?: FindingStatus) {
  return prisma.securityFinding.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
  });
}

export async function acknowledgeFinding(id: string) {
  const existing = await prisma.securityFinding.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, "Finding não encontrado");
  }
  return prisma.securityFinding.update({
    where: { id },
    data: {
      status: FindingStatus.ACKNOWLEDGED,
      evidence: {
        acknowledgedAt: new Date().toISOString(),
      } as Prisma.InputJsonValue,
    },
  });
}

export function parseFindingStatus(value: unknown): FindingStatus | undefined {
  if (typeof value !== "string") return undefined;
  const allowed = new Set<string>(Object.values(FindingStatus));
  if (!allowed.has(value)) return undefined;
  return value as FindingStatus;
}
