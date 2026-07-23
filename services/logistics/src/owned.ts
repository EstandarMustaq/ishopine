/**
 * Phase 20: logistics owns /api/logistics when LOGISTICS_OWNED≠0.
 * Real zones/adapters/shipments/HMAC — no Correios/DHL or multi-PoP CDN.
 */
import http from "node:http";
import { PlatformRole, TenantType } from "@prisma/client";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME, TENANT_HEADER } from "@ishopine/shared";
import {
  HttpError,
  createLabel,
  ensureAccountForUser,
  getShipment,
  handleCarrierWebhook,
  listCarriers,
  listCarrierPartners,
  listShipments,
  markDelivered,
  markInTransit,
  prisma,
  quote,
  renderLabelHtml,
  resolveTenantAccess,
  type TenantCtx,
} from "./logistics-core";

const jwtSecret = process.env.JWT_SECRET || "";

type JwtPayload = { sub: string };

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

function readRawBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

function parseJsonObject(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return {};
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

export async function handleOwnedLogistics(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const path = pathOnly(req.url);
  const method = (req.method || "GET").toUpperCase();

  if (!path.startsWith("/api/logistics")) return false;

  try {
    if (method === "GET" && path === "/api/logistics/carriers") {
      json(res, 200, listCarriers());
      return true;
    }

    if (method === "GET" && path === "/api/logistics/partners") {
      json(res, 200, listCarrierPartners());
      return true;
    }

    if (method === "POST" && path === "/api/logistics/quote") {
      const raw = await readRawBody(req);
      const body = parseJsonObject(raw);
      if (typeof body.destinationProvince !== "string") {
        throw new HttpError(400, "destinationProvince obrigatório");
      }
      if (typeof body.destinationDistrict !== "string") {
        throw new HttpError(400, "destinationDistrict obrigatório");
      }
      if (typeof body.subtotalCents !== "number") {
        throw new HttpError(400, "subtotalCents obrigatório");
      }
      json(
        res,
        200,
        await quote({
          tenantId:
            typeof body.tenantId === "string" ? body.tenantId : undefined,
          shopId: typeof body.shopId === "string" ? body.shopId : undefined,
          destinationProvince: body.destinationProvince,
          destinationDistrict: body.destinationDistrict,
          weightKg:
            typeof body.weightKg === "number" ? body.weightKg : undefined,
          subtotalCents: body.subtotalCents,
        }),
      );
      return true;
    }

    const webhookMatch = path.match(/^\/api\/logistics\/webhooks\/([^/]+)$/);
    if (method === "POST" && webhookMatch) {
      const raw = await readRawBody(req);
      const body = parseJsonObject(raw);
      json(
        res,
        200,
        await handleCarrierWebhook(
          decodeURIComponent(webhookMatch[1]),
          {
            trackingCode:
              typeof body.trackingCode === "string"
                ? body.trackingCode
                : undefined,
            shipmentId:
              typeof body.shipmentId === "string" ? body.shipmentId : undefined,
            status: typeof body.status === "string" ? body.status : undefined,
            note: typeof body.note === "string" ? body.note : undefined,
          },
          raw,
          headerValue(req, "x-carrier-signature"),
        ),
      );
      return true;
    }

    if (method === "GET" && path === "/api/logistics/shipments") {
      const { tenant } = await requireTenant(req, [TenantType.STORE]);
      const q = queryAll(req.url);
      json(
        res,
        200,
        await listShipments({
          shopId: tenant.shopId ?? undefined,
          take: q.take ? Number(q.take) : 40,
        }),
      );
      return true;
    }

    const labelHtmlMatch = path.match(
      /^\/api\/logistics\/shipments\/([^/]+)\/label$/,
    );
    if (method === "GET" && labelHtmlMatch) {
      const html = await renderLabelHtml(
        decodeURIComponent(labelHtmlMatch[1]),
      );
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
      });
      res.end(html);
      return true;
    }

    if (method === "POST" && labelHtmlMatch) {
      await requireTenant(req, [TenantType.STORE]);
      const raw = await readRawBody(req);
      const body = parseJsonObject(raw);
      json(
        res,
        200,
        await createLabel(
          decodeURIComponent(labelHtmlMatch[1]),
          typeof body.trackingCode === "string" ? body.trackingCode : undefined,
        ),
      );
      return true;
    }

    const transitMatch = path.match(
      /^\/api\/logistics\/shipments\/([^/]+)\/transit$/,
    );
    if (method === "POST" && transitMatch) {
      await requireTenant(req, [TenantType.STORE]);
      json(
        res,
        200,
        await markInTransit(decodeURIComponent(transitMatch[1])),
      );
      return true;
    }

    const deliveredMatch = path.match(
      /^\/api\/logistics\/shipments\/([^/]+)\/delivered$/,
    );
    if (method === "POST" && deliveredMatch) {
      await requireTenant(req, [TenantType.STORE]);
      json(
        res,
        200,
        await markDelivered(decodeURIComponent(deliveredMatch[1])),
      );
      return true;
    }

    const shipmentMatch = path.match(/^\/api\/logistics\/shipments\/([^/]+)$/);
    if (method === "GET" && shipmentMatch) {
      await requireAuth(req);
      const shipment = await getShipment(
        decodeURIComponent(shipmentMatch[1]),
      );
      json(res, 200, shipment);
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
    console.error("[logistics] owned error", error);
    json(res, 500, "Erro interno de logistics");
    return true;
  }
}
