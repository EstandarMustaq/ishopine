/**
 * Phase 29: platform-security owns /api/security when OWNED≠0.
 */
import http from "node:http";
import { PlatformRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME } from "@ishopine/shared";
import {
  HttpError,
  acknowledgeFinding,
  complianceSnapshot,
  listFindings,
  parseFindingStatus,
  prisma,
  syncSystem,
} from "./security-core";

const jwtSecret = process.env.JWT_SECRET || "";
const orgSlug = process.env.PLATFORM_ORG_SLUG || "ishopine";
const isProd = process.env.NODE_ENV === "production";

type JwtPayload = { sub: string; tfa?: boolean };

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

function queryParam(url: string | undefined, key: string): string | undefined {
  try {
    const u = new URL(url || "/", "http://local");
    return u.searchParams.get(key) ?? undefined;
  } catch {
    return undefined;
  }
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

async function requireAdmin(req: http.IncomingMessage) {
  const { jwt: payload, user } = await requireAuth(req);
  if (user.platformRole !== PlatformRole.PLATFORM_ADMIN) {
    throw new HttpError(403, "Acesso não autorizado para este perfil");
  }
  await assertStaff2fa(user, payload.tfa);
  return user;
}

function isOwnedPath(path: string) {
  return path.startsWith("/api/security");
}

export async function handleOwnedPlatformSecurity(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const path = pathOnly(req.url);
  const method = (req.method || "GET").toUpperCase();

  if (!isOwnedPath(path)) return false;

  try {
    if (method === "GET" && path === "/api/security/compliance") {
      await requireAdmin(req);
      json(res, 200, complianceSnapshot());
      return true;
    }

    if (method === "GET" && path === "/api/security/findings") {
      await requireAdmin(req);
      const status = parseFindingStatus(queryParam(req.url, "status"));
      json(res, 200, await listFindings(status));
      return true;
    }

    if (method === "POST" && path === "/api/security/sync") {
      await requireAdmin(req);
      json(res, 200, await syncSystem());
      return true;
    }

    const ackMatch = path.match(/^\/api\/security\/findings\/([^/]+)\/acknowledge$/);
    if (method === "POST" && ackMatch) {
      await requireAdmin(req);
      json(res, 200, await acknowledgeFinding(ackMatch[1]));
      return true;
    }

    return false;
  } catch (error) {
    if (error instanceof HttpError) {
      json(res, error.status, error.message);
      return true;
    }
    console.error("[platform-security] owned error", error);
    json(res, 500, "Erro interno");
    return true;
  }
}
