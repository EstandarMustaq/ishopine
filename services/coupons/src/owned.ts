/**
 * Phase 24: coupons owns /api/coupons when COUPONS_OWNED≠0.
 */
import http from "node:http";
import { CouponType, PlatformRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME } from "@ishopine/shared";
import {
  HttpError,
  createCoupon,
  listCoupons,
  prisma,
  validateCoupon,
} from "./coupons-core";

const jwtSecret = process.env.JWT_SECRET || "";

type JwtPayload = { sub: string };

const COUPON_TYPES = new Set<string>(Object.values(CouponType));

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

async function requireRoles(req: http.IncomingMessage, roles: PlatformRole[]) {
  const user = await requireAuth(req);
  if (!roles.includes(user.platformRole)) {
    throw new HttpError(403, "Acesso não autorizado para este perfil");
  }
  return user;
}

export async function handleOwnedCoupons(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const path = pathOnly(req.url);
  const method = (req.method || "GET").toUpperCase();

  if (!path.startsWith("/api/coupons")) return false;

  try {
    if (method === "GET" && path === "/api/coupons") {
      await requireRoles(req, [
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.PLATFORM_OPERATOR,
      ]);
      json(res, 200, await listCoupons());
      return true;
    }

    if (method === "POST" && path === "/api/coupons") {
      const user = await requireRoles(req, [PlatformRole.PLATFORM_ADMIN]);
      const body = await readJsonBody(req);
      if (typeof body.code !== "string" || !body.code.trim()) {
        throw new HttpError(400, "code obrigatório");
      }
      if (typeof body.type !== "string" || !COUPON_TYPES.has(body.type)) {
        throw new HttpError(400, "type inválido");
      }
      if (typeof body.value !== "number" || !Number.isFinite(body.value)) {
        throw new HttpError(400, "value obrigatório");
      }
      json(
        res,
        201,
        await createCoupon(user.id, {
          code: body.code,
          type: body.type as CouponType,
          value: body.value,
          minSubtotalCents:
            typeof body.minSubtotalCents === "number"
              ? body.minSubtotalCents
              : undefined,
          maxUses: typeof body.maxUses === "number" ? body.maxUses : undefined,
          endsAt: typeof body.endsAt === "string" ? body.endsAt : undefined,
        }),
      );
      return true;
    }

    if (method === "POST" && path === "/api/coupons/validate") {
      const body = await readJsonBody(req);
      if (typeof body.code !== "string" || !body.code.trim()) {
        throw new HttpError(400, "code obrigatório");
      }
      if (
        typeof body.subtotalCents !== "number" ||
        !Number.isFinite(body.subtotalCents)
      ) {
        throw new HttpError(400, "subtotalCents obrigatório");
      }
      json(res, 200, await validateCoupon(body.code, body.subtotalCents));
      return true;
    }

    return false;
  } catch (error) {
    if (error instanceof HttpError) {
      json(res, error.status, error.message);
      return true;
    }
    console.error("[coupons] owned error", error);
    json(res, 500, "Erro interno");
    return true;
  }
}
