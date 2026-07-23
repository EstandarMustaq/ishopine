/**
 * Phase 27: platform-settings owns dashboard + store/platform settings
 * when PLATFORM_SETTINGS_OWNED≠0.
 */
import http from "node:http";
import { PlatformRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME } from "@ishopine/shared";
import {
  HttpError,
  charts,
  overview,
  platformSettings,
  prisma,
  updatePlatformSettings,
} from "./platform-core";

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

function isOwnedPath(path: string) {
  return (
    path.startsWith("/api/dashboard") ||
    path === "/api/store/settings" ||
    path === "/api/platform/settings"
  );
}

export async function handleOwnedPlatformSettings(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const path = pathOnly(req.url);
  const method = (req.method || "GET").toUpperCase();

  if (!isOwnedPath(path)) return false;

  try {
    if (method === "GET" && path === "/api/dashboard/overview") {
      await requireStaff(req, [
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.PLATFORM_OPERATOR,
      ]);
      json(res, 200, await overview());
      return true;
    }

    if (method === "GET" && path === "/api/dashboard/charts") {
      await requireStaff(req, [
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.PLATFORM_OPERATOR,
      ]);
      json(res, 200, await charts());
      return true;
    }

    if (
      method === "GET" &&
      (path === "/api/store/settings" || path === "/api/platform/settings")
    ) {
      json(res, 200, await platformSettings());
      return true;
    }

    if (
      method === "PATCH" &&
      (path === "/api/store/settings" || path === "/api/platform/settings")
    ) {
      await requireStaff(req, [PlatformRole.PLATFORM_ADMIN]);
      const body = await readJsonBody(req);
      json(
        res,
        200,
        await updatePlatformSettings({
          marketplaceName:
            typeof body.marketplaceName === "string"
              ? body.marketplaceName
              : undefined,
          tagline: typeof body.tagline === "string" ? body.tagline : undefined,
          shippingFlatCents:
            typeof body.shippingFlatCents === "number"
              ? body.shippingFlatCents
              : undefined,
          freeShippingCents:
            typeof body.freeShippingCents === "number"
              ? body.freeShippingCents
              : undefined,
          requireSeller2fa:
            typeof body.requireSeller2fa === "boolean"
              ? body.requireSeller2fa
              : undefined,
          requireEmailVerify:
            typeof body.requireEmailVerify === "boolean"
              ? body.requireEmailVerify
              : undefined,
          commissionBps:
            typeof body.commissionBps === "number"
              ? body.commissionBps
              : undefined,
          currency: typeof body.currency === "string" ? body.currency : undefined,
          supportEmail:
            typeof body.supportEmail === "string" ? body.supportEmail : undefined,
          supportPhone:
            typeof body.supportPhone === "string" ? body.supportPhone : undefined,
          logoUrl: typeof body.logoUrl === "string" ? body.logoUrl : undefined,
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
    if (error instanceof SyntaxError) {
      json(res, 400, "JSON inválido");
      return true;
    }
    console.error("[platform-settings] owned error", error);
    json(res, 500, "Erro interno");
    return true;
  }
}
