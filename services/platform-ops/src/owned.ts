/**
 * Phase 28: platform-ops owns users admin + reliability + cron when OWNED≠0.
 */
import http from "node:http";
import { PlatformRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME } from "@ishopine/shared";
import {
  HttpError,
  cronOutbox,
  listUsers,
  parsePlatformRole,
  prisma,
  reliabilityHealth,
  reliabilitySync,
  setUserActive,
  updateUserRole,
} from "./ops-core";

const jwtSecret = process.env.JWT_SECRET || "";
const cronSecret = process.env.CRON_SECRET || "";
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

async function requireStaff(req: http.IncomingMessage, roles: PlatformRole[]) {
  const { jwt: payload, user } = await requireAuth(req);
  if (!roles.includes(user.platformRole)) {
    throw new HttpError(403, "Acesso não autorizado para este perfil");
  }
  await assertStaff2fa(user, payload.tfa);
  return user;
}

function assertCronSecret(req: http.IncomingMessage) {
  if (!cronSecret) {
    throw new HttpError(401, "CRON_SECRET not configured");
  }
  const expected = `Bearer ${cronSecret}`;
  if (req.headers.authorization !== expected) {
    throw new HttpError(401, "Invalid cron secret");
  }
}

function isOwnedPath(path: string) {
  return (
    path === "/api/users" ||
    /^\/api\/users\/[^/]+\/(role|active)$/.test(path) ||
    path.startsWith("/api/reliability") ||
    path.startsWith("/api/cron")
  );
}

export async function handleOwnedPlatformOps(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const path = pathOnly(req.url);
  const method = (req.method || "GET").toUpperCase();

  if (!isOwnedPath(path)) return false;

  try {
    if (method === "GET" && path === "/api/users") {
      await requireStaff(req, [PlatformRole.PLATFORM_ADMIN]);
      const role = parsePlatformRole(queryParam(req.url, "role"));
      json(res, 200, await listUsers(role));
      return true;
    }

    const roleMatch = path.match(/^\/api\/users\/([^/]+)\/role$/);
    if (method === "PATCH" && roleMatch) {
      await requireStaff(req, [PlatformRole.PLATFORM_ADMIN]);
      const body = await readJsonBody(req);
      const platformRole = parsePlatformRole(
        body.platformRole ?? body.role,
      );
      if (!platformRole) {
        throw new HttpError(400, "Papel inválido");
      }
      json(res, 200, await updateUserRole(roleMatch[1], platformRole));
      return true;
    }

    const activeMatch = path.match(/^\/api\/users\/([^/]+)\/active$/);
    if (method === "PATCH" && activeMatch) {
      await requireStaff(req, [PlatformRole.PLATFORM_ADMIN]);
      const body = await readJsonBody(req);
      if (typeof body.isActive !== "boolean") {
        throw new HttpError(400, "isActive deve ser boolean");
      }
      json(res, 200, await setUserActive(activeMatch[1], body.isActive));
      return true;
    }

    if (method === "GET" && path === "/api/reliability/health") {
      await requireStaff(req, [
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.PLATFORM_OPERATOR,
      ]);
      json(res, 200, await reliabilityHealth());
      return true;
    }

    if (method === "POST" && path === "/api/reliability/sync") {
      await requireStaff(req, [
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.PLATFORM_OPERATOR,
      ]);
      json(res, 200, await reliabilitySync());
      return true;
    }

    if (
      (method === "GET" || method === "POST") &&
      path === "/api/cron/outbox"
    ) {
      assertCronSecret(req);
      json(res, 200, await cronOutbox());
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
    console.error("[platform-ops] owned error", error);
    json(res, 500, "Erro interno");
    return true;
  }
}
