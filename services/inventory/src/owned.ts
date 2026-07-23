/**
 * Phase 24: inventory owns /api/inventory when INVENTORY_OWNED≠0.
 * Nest parity: JWT + roles + TwoFactorGuard + TenantGuard (staff may omit tenant).
 */
import http from "node:http";
import {
  InventoryMovementType,
  PlatformRole,
  TenantType,
} from "@prisma/client";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME, TENANT_HEADER } from "@ishopine/shared";
import {
  HttpError,
  adjust,
  listMovements,
  lowStock,
  prisma,
} from "./inventory-core";

const jwtSecret = process.env.JWT_SECRET || "";
const orgSlug = process.env.PLATFORM_ORG_SLUG || "ishopine";
const isProd = process.env.NODE_ENV === "production";

type JwtPayload = { sub: string; tfa?: boolean };

const MOVEMENT_TYPES = new Set<string>(Object.values(InventoryMovementType));

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

function headerValue(
  req: http.IncomingMessage,
  name: string,
): string | undefined {
  const raw = req.headers[name];
  if (Array.isArray(raw)) return raw[0];
  return typeof raw === "string" ? raw : undefined;
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
    select: {
      id: true,
      platformRole: true,
      totpEnabled: true,
      canSell: true,
    },
  });
  if (!user) throw new HttpError(401, "Não autenticado");
  return { jwt: payload, user };
}

/** Nest TwoFactorGuard parity for elevated staff/sellers. */
async function assertStaff2fa(
  user: { totpEnabled: boolean; platformRole: PlatformRole; canSell: boolean },
  tfa?: boolean,
) {
  if (user.totpEnabled) {
    if (!tfa) {
      throw new HttpError(
        403,
        "Autenticação de dois fatores necessária. Complete o login 2FA.",
      );
    }
    return;
  }
  const elevated =
    user.platformRole === PlatformRole.PLATFORM_ADMIN ||
    user.platformRole === PlatformRole.PLATFORM_OPERATOR ||
    user.canSell;
  if (!elevated) return;

  const settings = await prisma.platformSettings.findFirst({
    where: { organization: { slug: orgSlug } },
  });
  if ((settings?.requireSeller2fa ?? true) && isProd) {
    throw new HttpError(
      403,
      "Configure a autenticação de dois fatores antes de acessar o painel.",
    );
  }
}

async function requireInventoryAccess(req: http.IncomingMessage) {
  const { jwt: payload, user } = await requireAuth(req);
  const allowed: PlatformRole[] = [
    PlatformRole.PLATFORM_ADMIN,
    PlatformRole.PLATFORM_OPERATOR,
    PlatformRole.SELLER,
  ];
  if (!allowed.includes(user.platformRole)) {
    throw new HttpError(403, "Acesso não autorizado para este perfil");
  }
  await assertStaff2fa(user, payload.tfa);

  // Nest TenantGuard: staff may omit x-tenant-id; sellers must send PARTICULAR|STORE.
  const isStaff =
    user.platformRole === PlatformRole.PLATFORM_ADMIN ||
    user.platformRole === PlatformRole.PLATFORM_OPERATOR;
  const tenantId = headerValue(req, TENANT_HEADER);
  if (!tenantId) {
    if (isStaff) return user;
    throw new HttpError(
      403,
      `Cabeçalho ${TENANT_HEADER} é obrigatório neste recurso`,
    );
  }

  const account = await prisma.account.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!account) {
    throw new HttpError(403, "Conta não encontrada");
  }
  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_accountId: { tenantId, accountId: account.id } },
    include: { tenant: { select: { id: true, type: true, isActive: true } } },
  });
  if (!membership?.isActive || !membership.tenant.isActive) {
    throw new HttpError(403, "Sem acesso a este tenant");
  }
  const allowedTypes: TenantType[] = [TenantType.PARTICULAR, TenantType.STORE];
  if (!allowedTypes.includes(membership.tenant.type)) {
    throw new HttpError(
      403,
      `Este recurso só aceita tenant: ${allowedTypes.join(", ")}`,
    );
  }
  return user;
}

export async function handleOwnedInventory(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const path = pathOnly(req.url);
  const method = (req.method || "GET").toUpperCase();

  if (!path.startsWith("/api/inventory")) return false;

  try {
    if (method === "GET" && path === "/api/inventory/movements") {
      await requireInventoryAccess(req);
      const q = queryAll(req.url);
      json(res, 200, await listMovements(q.productId || undefined));
      return true;
    }

    if (method === "GET" && path === "/api/inventory/low-stock") {
      await requireInventoryAccess(req);
      const q = queryAll(req.url);
      const threshold = q.threshold ? Number(q.threshold) : 5;
      json(
        res,
        200,
        await lowStock(Number.isFinite(threshold) ? threshold : 5),
      );
      return true;
    }

    const adjustMatch = path.match(/^\/api\/inventory\/([^/]+)\/adjust$/);
    if (method === "POST" && adjustMatch) {
      const user = await requireInventoryAccess(req);
      const body = await readJsonBody(req);
      if (typeof body.type !== "string" || !MOVEMENT_TYPES.has(body.type)) {
        throw new HttpError(400, "type inválido");
      }
      if (typeof body.quantity !== "number" || !Number.isFinite(body.quantity)) {
        throw new HttpError(400, "quantity obrigatório");
      }
      if (typeof body.reason !== "string" || !body.reason.trim()) {
        throw new HttpError(400, "reason obrigatório");
      }
      json(
        res,
        201,
        await adjust(decodeURIComponent(adjustMatch[1]), {
          type: body.type as InventoryMovementType,
          quantity: body.quantity,
          reason: body.reason,
          operatorId: user.id,
        }),
      );
      return true;
    }

    return false;
  } catch (error) {
    if (error instanceof HttpError) {
      json(res, error.status, error.message);
      return true;
    }
    console.error("[inventory] owned error", error);
    json(res, 500, "Erro interno");
    return true;
  }
}
