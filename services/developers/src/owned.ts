/**
 * Phase 19: developers owns /api/developers, /api/v1, /api/feature-flags
 * when DEVELOPERS_OWNED≠0. Webhook fan-out stays Nest outbox.
 */
import http from "node:http";
import {
  PlatformRole,
  PricingPlanCode,
  TenantType,
} from "@prisma/client";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME, TENANT_HEADER } from "@ishopine/shared";
import {
  HttpError,
  authenticateApiKey,
  createApiKey,
  ensureAccountForUser,
  evaluateFlag,
  evaluateMany,
  listApiKeys,
  listFlags,
  listV1Orders,
  listV1Products,
  listWebhooks,
  prisma,
  resolveTenantAccess,
  revokeApiKey,
  rotateWebhookSecret,
  setFlagEnabled,
  setFlagOverride,
  upsertWebhook,
  type TenantCtx,
} from "./developers-core";

const jwtSecret = process.env.JWT_SECRET || "";

type JwtPayload = { sub: string };

const PLAN_CODES = new Set<string>(Object.values(PricingPlanCode));

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

function pathOnly(url?: string) {
  return (url || "/").split("?")[0];
}

function queryAll(url: string | undefined): Record<string, string> {
  const q = (url || "").split("?")[1];
  if (!q) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(q).entries()) out[k] = v;
  return out;
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

async function requireAuth(req: http.IncomingMessage) {
  const payload = verifyJwt(req);
  if (!payload?.sub) throw new HttpError(401, "Não autenticado");
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, platformRole: true },
  });
  if (!user) throw new HttpError(401, "Não autenticado");
  return user;
}

async function requireTenant(
  req: http.IncomingMessage,
  allowed: TenantType[],
): Promise<{ userId: string; tenant: TenantCtx; platformRole: PlatformRole }> {
  const user = await requireAuth(req);
  const tenantId = headerValue(req, TENANT_HEADER);
  const isStaff =
    user.platformRole === PlatformRole.PLATFORM_ADMIN ||
    user.platformRole === PlatformRole.PLATFORM_OPERATOR;

  if (!tenantId) {
    if (isStaff) {
      throw new HttpError(400, "Tenant em falta para esta operação");
    }
    throw new HttpError(
      403,
      `Cabeçalho ${TENANT_HEADER} é obrigatório neste recurso`,
    );
  }

  const account = await ensureAccountForUser(user.id);
  const tenant = await resolveTenantAccess(account.id, tenantId);
  if (allowed.length && !allowed.includes(tenant.tenantType)) {
    throw new HttpError(
      403,
      `Este recurso só aceita tenant: ${allowed.join(", ")}`,
    );
  }
  return { userId: user.id, tenant, platformRole: user.platformRole };
}

async function requireStaff(req: http.IncomingMessage) {
  const user = await requireAuth(req);
  if (
    user.platformRole !== PlatformRole.PLATFORM_ADMIN &&
    user.platformRole !== PlatformRole.PLATFORM_OPERATOR
  ) {
    throw new HttpError(403, "Acesso não autorizado para este perfil");
  }
  return user;
}

async function requireApiKey(req: http.IncomingMessage) {
  const auth = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  if (!match) {
    throw new HttpError(401, "Bearer API key necessária");
  }
  return authenticateApiKey(match[1].trim());
}

function isDevelopersPath(path: string) {
  return (
    path.startsWith("/api/developers") ||
    path.startsWith("/api/v1") ||
    path.startsWith("/api/feature-flags")
  );
}

export async function handleOwnedDevelopers(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const path = pathOnly(req.url);
  const method = (req.method || "GET").toUpperCase();

  if (!isDevelopersPath(path)) return false;

  try {
    /* ── Public Commerce API (API key) ────────────────────── */
    if (method === "GET" && path === "/api/v1/me") {
      const ctx = await requireApiKey(req);
      json(res, 200, {
        tenantId: ctx.tenantId,
        shopId: ctx.shopId,
        apiKeyId: ctx.apiKeyId,
      });
      return true;
    }
    if (method === "GET" && path === "/api/v1/products") {
      const ctx = await requireApiKey(req);
      json(res, 200, await listV1Products(ctx.tenantId, ctx.shopId));
      return true;
    }
    if (method === "GET" && path === "/api/v1/orders") {
      const ctx = await requireApiKey(req);
      json(res, 200, await listV1Orders(ctx.tenantId, ctx.shopId));
      return true;
    }

    /* ── Feature flags ────────────────────────────────────── */
    if (method === "GET" && path === "/api/feature-flags/evaluate") {
      const { tenant } = await requireTenant(req, [
        TenantType.PARTICULAR,
        TenantType.STORE,
      ]);
      const q = queryAll(req.url);
      const list = (q.keys || "developer_platform,store_hours_policies")
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      const planCode =
        q.plan && PLAN_CODES.has(q.plan)
          ? (q.plan as PricingPlanCode)
          : null;
      json(
        res,
        200,
        await evaluateMany(list, {
          tenantId: tenant.tenantId,
          planCode,
        }),
      );
      return true;
    }
    if (method === "GET" && path === "/api/feature-flags") {
      await requireStaff(req);
      json(res, 200, await listFlags());
      return true;
    }
    const flagKeyMatch = path.match(/^\/api\/feature-flags\/([^/]+)$/);
    if (method === "PATCH" && flagKeyMatch) {
      await requireStaff(req);
      const body = await readJsonBody(req);
      json(
        res,
        200,
        await setFlagEnabled(
          decodeURIComponent(flagKeyMatch[1]),
          Boolean(body.enabled),
        ),
      );
      return true;
    }
    const overrideMatch = path.match(
      /^\/api\/feature-flags\/([^/]+)\/overrides$/,
    );
    if (method === "POST" && overrideMatch) {
      await requireStaff(req);
      const body = await readJsonBody(req);
      if (typeof body.scopeKey !== "string") {
        throw new HttpError(400, "scopeKey obrigatório");
      }
      json(
        res,
        201,
        await setFlagOverride({
          key: decodeURIComponent(overrideMatch[1]),
          scopeKey: body.scopeKey,
          enabled: Boolean(body.enabled),
          tenantId:
            typeof body.tenantId === "string" ? body.tenantId : undefined,
        }),
      );
      return true;
    }

    /* ── Developer console (JWT + STORE tenant) ───────────── */
    if (method === "GET" && path === "/api/developers/status") {
      const { tenant } = await requireTenant(req, [TenantType.STORE]);
      const flag = await evaluateFlag({
        key: "developer_platform",
        tenantId: tenant.tenantId,
      });
      json(res, 200, {
        enabled: flag.enabled,
        source: flag.source,
        tenantId: tenant.tenantId,
      });
      return true;
    }
    if (method === "GET" && path === "/api/developers/keys") {
      const { tenant } = await requireTenant(req, [TenantType.STORE]);
      json(res, 200, await listApiKeys(tenant.tenantId));
      return true;
    }
    if (method === "POST" && path === "/api/developers/keys") {
      const { userId, tenant } = await requireTenant(req, [TenantType.STORE]);
      const body = await readJsonBody(req);
      const created = await createApiKey(
        userId,
        tenant.tenantId,
        typeof body.name === "string" ? body.name : "Default",
      );
      json(res, 201, created);
      return true;
    }
    const keyMatch = path.match(/^\/api\/developers\/keys\/([^/]+)$/);
    if (method === "DELETE" && keyMatch) {
      const { userId, tenant } = await requireTenant(req, [TenantType.STORE]);
      json(
        res,
        200,
        await revokeApiKey(
          userId,
          tenant.tenantId,
          decodeURIComponent(keyMatch[1]),
        ),
      );
      return true;
    }
    if (method === "GET" && path === "/api/developers/webhooks") {
      const { tenant } = await requireTenant(req, [TenantType.STORE]);
      json(res, 200, await listWebhooks(tenant.tenantId));
      return true;
    }
    if (method === "POST" && path === "/api/developers/webhooks") {
      const { userId, tenant } = await requireTenant(req, [TenantType.STORE]);
      const body = await readJsonBody(req);
      if (typeof body.url !== "string") {
        throw new HttpError(400, "URL de webhook inválida");
      }
      const events = Array.isArray(body.events)
        ? body.events.filter((e): e is string => typeof e === "string")
        : undefined;
      json(
        res,
        201,
        await upsertWebhook(userId, tenant.tenantId, {
          url: body.url,
          events,
        }),
      );
      return true;
    }
    const rotateMatch = path.match(
      /^\/api\/developers\/webhooks\/([^/]+)\/rotate$/,
    );
    if (method === "POST" && rotateMatch) {
      const { userId, tenant } = await requireTenant(req, [TenantType.STORE]);
      json(
        res,
        200,
        await rotateWebhookSecret(
          userId,
          tenant.tenantId,
          decodeURIComponent(rotateMatch[1]),
        ),
      );
      return true;
    }

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
    console.error("[developers] owned error", error);
    json(res, 500, "Erro interno de developers");
    return true;
  }
}
