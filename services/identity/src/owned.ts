/**
 * Phase 13: identity owns local auth / 2FA / session when IDENTITY_OWNED≠0.
 * Google OAuth (`/api/auth/google*`) falls through to Nest (Passport).
 */
import http from "node:http";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME } from "@ishopine/shared";
import {
  AuthHttpError,
  disable2fa,
  enable2fa,
  login,
  me,
  register,
  resendCode,
  setup2fa,
  verify2fa,
  verifyEmail,
} from "./auth-core";

const jwtSecret = process.env.JWT_SECRET || "";
const cookieName = process.env.AUTH_COOKIE_NAME || AUTH_COOKIE_NAME;
const isProd = process.env.NODE_ENV === "production";
const cookieDomain = process.env.COOKIE_DOMAIN || "";

type JwtPayload = { sub: string; tfa?: boolean };

/** Simple sliding-window throttle (parity with Nest Throttler limits). */
const buckets = new Map<string, number[]>();

function throttle(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

function clientKey(req: http.IncomingMessage, route: string) {
  const xf = req.headers["x-forwarded-for"];
  const ip =
    (typeof xf === "string" ? xf.split(",")[0]?.trim() : undefined) ||
    req.socket.remoteAddress ||
    "unknown";
  return `${ip}:${route}`;
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
  return parseCookie(req.headers.cookie, cookieName);
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

function nestStyleError(status: number, message: string) {
  const error =
    status === 401
      ? "Unauthorized"
      : status === 409
        ? "Conflict"
        : status === 400
          ? "Bad Request"
          : status === 429
            ? "Too Many Requests"
            : "Error";
  return { statusCode: status, message, error };
}

function json(
  res: http.ServerResponse,
  status: number,
  body: unknown,
  extraHeaders?: Record<string, string | string[]>,
) {
  const headers: Record<string, string | string[]> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

function buildSetCookie(accessToken: string): string {
  const maxAge = 7 * 24 * 60 * 60;
  const parts = [
    `${cookieName}=${encodeURIComponent(accessToken)}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${maxAge}`,
    "SameSite=Lax",
  ];
  if (isProd || cookieDomain) {
    parts.push("Secure");
  }
  if (cookieDomain) {
    parts.push(`Domain=${cookieDomain}`);
  }
  return parts.join("; ");
}

function buildClearCookie(): string {
  const parts = [
    `${cookieName}=`,
    "HttpOnly",
    "Path=/",
    "Max-Age=0",
    "SameSite=Lax",
  ];
  if (cookieDomain) {
    parts.push(`Domain=${cookieDomain}`);
  }
  return parts.join("; ");
}

function attachSessionCookie(
  result: unknown,
): Record<string, string | string[]> | undefined {
  if (
    result &&
    typeof result === "object" &&
    "accessToken" in result &&
    typeof (result as { accessToken: unknown }).accessToken === "string"
  ) {
    return {
      "Set-Cookie": buildSetCookie(
        (result as { accessToken: string }).accessToken,
      ),
    };
  }
  return undefined;
}

async function requireUser(req: http.IncomingMessage): Promise<string> {
  const payload = verifyJwt(req);
  if (!payload?.sub) {
    throw new AuthHttpError(401, "Não autenticado");
  }
  return payload.sub;
}

export async function handleOwnedIdentity(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const path = pathOnly(req.url);
  const method = (req.method || "GET").toUpperCase();

  // Google OAuth stays on Nest (Passport strategies + redirects).
  if (path.startsWith("/api/auth/google")) {
    return false;
  }

  if (!path.startsWith("/api/auth")) {
    return false;
  }

  try {
    if (method === "POST" && path === "/api/auth/register") {
      if (!throttle(clientKey(req, "register"), 5, 60_000)) {
        json(res, 429, nestStyleError(429, "Demasiados pedidos"));
        return true;
      }
      const body = await readJsonBody(req);
      json(res, 201, await register(body));
      return true;
    }

    if (method === "POST" && path === "/api/auth/verify-email") {
      if (!throttle(clientKey(req, "verify-email"), 10, 60_000)) {
        json(res, 429, nestStyleError(429, "Demasiados pedidos"));
        return true;
      }
      const body = await readJsonBody(req);
      const result = await verifyEmail(body);
      json(res, 200, result, attachSessionCookie(result));
      return true;
    }

    if (method === "POST" && path === "/api/auth/resend-code") {
      if (!throttle(clientKey(req, "resend-code"), 5, 60_000)) {
        json(res, 429, nestStyleError(429, "Demasiados pedidos"));
        return true;
      }
      const body = await readJsonBody(req);
      json(res, 200, await resendCode(body));
      return true;
    }

    if (method === "POST" && path === "/api/auth/login") {
      if (!throttle(clientKey(req, "login"), 10, 60_000)) {
        json(res, 429, nestStyleError(429, "Demasiados pedidos"));
        return true;
      }
      const body = await readJsonBody(req);
      const result = await login(body);
      json(res, 200, result, attachSessionCookie(result));
      return true;
    }

    if (method === "POST" && path === "/api/auth/verify-2fa") {
      if (!throttle(clientKey(req, "verify-2fa"), 10, 60_000)) {
        json(res, 429, nestStyleError(429, "Demasiados pedidos"));
        return true;
      }
      const body = await readJsonBody(req);
      const result = await verify2fa(body);
      json(res, 200, result, attachSessionCookie(result));
      return true;
    }

    if (method === "POST" && path === "/api/auth/logout") {
      json(res, 200, { ok: true }, { "Set-Cookie": buildClearCookie() });
      return true;
    }

    if (method === "POST" && path === "/api/auth/2fa/setup") {
      const userId = await requireUser(req);
      json(res, 200, await setup2fa(userId));
      return true;
    }

    if (method === "POST" && path === "/api/auth/2fa/enable") {
      const userId = await requireUser(req);
      const body = await readJsonBody(req);
      json(res, 200, await enable2fa(userId, body));
      return true;
    }

    if (method === "POST" && path === "/api/auth/2fa/disable") {
      const userId = await requireUser(req);
      const body = await readJsonBody(req);
      json(res, 200, await disable2fa(userId, body));
      return true;
    }

    if (method === "GET" && path === "/api/auth/me") {
      const userId = await requireUser(req);
      json(res, 200, await me(userId));
      return true;
    }

    if (method === "GET" && path === "/api/auth/session") {
      const userId = await requireUser(req);
      const user = await me(userId);
      json(res, 200, { authenticated: true, user });
      return true;
    }

    // Unknown /api/auth/* → Nest fallthrough (future routes).
    return false;
  } catch (error) {
    if (error instanceof AuthHttpError) {
      json(res, error.status, nestStyleError(error.status, error.message));
      return true;
    }
    if (error instanceof SyntaxError) {
      json(res, 400, nestStyleError(400, "JSON inválido"));
      return true;
    }
    console.error("[identity] owned error", error);
    json(res, 500, nestStyleError(500, "Erro interno de identidade"));
    return true;
  }
}
