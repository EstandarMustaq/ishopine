/**
 * Phase 21: accounting owns /api/accounting when ACCOUNTING_OWNED≠0.
 * Staff roles + TwoFactorGuard parity — no carrier/CDN theater.
 */
import http from "node:http";
import {
  AccountingEntryStatus,
  AccountingEntryType,
  PlatformRole,
} from "@prisma/client";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME } from "@ishopine/shared";
import {
  HttpError,
  createAccount,
  createEntry,
  listAccounts,
  listEntries,
  postEntry,
  prisma,
  summary,
  voidEntry,
} from "./accounting-core";

const jwtSecret = process.env.JWT_SECRET || "";
const orgSlug = process.env.PLATFORM_ORG_SLUG || "ishopine";
const isProd = process.env.NODE_ENV === "production";

type JwtPayload = { sub: string; tfa?: boolean };

const ENTRY_TYPES = new Set<string>(Object.values(AccountingEntryType));
const ENTRY_STATUSES = new Set<string>(Object.values(AccountingEntryStatus));

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

/** Nest TwoFactorGuard parity for elevated staff. */
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

async function requireStaff(
  req: http.IncomingMessage,
  roles: PlatformRole[],
) {
  const { jwt: payload, user } = await requireAuth(req);
  if (!roles.includes(user.platformRole)) {
    throw new HttpError(403, "Acesso não autorizado para este perfil");
  }
  await assertStaff2fa(user, payload.tfa);
  return user;
}

export async function handleOwnedAccounting(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const path = pathOnly(req.url);
  const method = (req.method || "GET").toUpperCase();

  if (!path.startsWith("/api/accounting")) return false;

  try {
    if (method === "GET" && path === "/api/accounting/accounts") {
      await requireStaff(req, [
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.PLATFORM_OPERATOR,
      ]);
      json(res, 200, await listAccounts());
      return true;
    }

    if (method === "POST" && path === "/api/accounting/accounts") {
      await requireStaff(req, [PlatformRole.PLATFORM_ADMIN]);
      const body = await readJsonBody(req);
      if (typeof body.code !== "string" || !body.code.trim()) {
        throw new HttpError(400, "code obrigatório");
      }
      if (typeof body.name !== "string" || !body.name.trim()) {
        throw new HttpError(400, "name obrigatório");
      }
      if (typeof body.type !== "string" || !ENTRY_TYPES.has(body.type)) {
        throw new HttpError(400, "type inválido");
      }
      json(
        res,
        201,
        await createAccount({
          code: body.code.trim(),
          name: body.name.trim(),
          type: body.type as AccountingEntryType,
          description:
            typeof body.description === "string" ? body.description : undefined,
        }),
      );
      return true;
    }

    if (method === "GET" && path === "/api/accounting/entries") {
      await requireStaff(req, [
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.PLATFORM_OPERATOR,
      ]);
      const q = queryAll(req.url);
      json(
        res,
        200,
        await listEntries({
          status:
            q.status && ENTRY_STATUSES.has(q.status)
              ? (q.status as AccountingEntryStatus)
              : undefined,
          type:
            q.type && ENTRY_TYPES.has(q.type)
              ? (q.type as AccountingEntryType)
              : undefined,
          from: q.from,
          to: q.to,
          page: q.page,
          limit: q.limit,
        }),
      );
      return true;
    }

    if (method === "GET" && path === "/api/accounting/summary") {
      await requireStaff(req, [
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.PLATFORM_OPERATOR,
      ]);
      json(res, 200, await summary());
      return true;
    }

    if (method === "POST" && path === "/api/accounting/entries") {
      const user = await requireStaff(req, [
        PlatformRole.PLATFORM_ADMIN,
        PlatformRole.PLATFORM_OPERATOR,
      ]);
      const body = await readJsonBody(req);
      if (typeof body.description !== "string") {
        throw new HttpError(400, "description obrigatório");
      }
      if (typeof body.type !== "string" || !ENTRY_TYPES.has(body.type)) {
        throw new HttpError(400, "type inválido");
      }
      if (typeof body.amountCents !== "number") {
        throw new HttpError(400, "amountCents obrigatório");
      }
      if (typeof body.debitAccountId !== "string") {
        throw new HttpError(400, "debitAccountId obrigatório");
      }
      if (typeof body.creditAccountId !== "string") {
        throw new HttpError(400, "creditAccountId obrigatório");
      }
      json(
        res,
        201,
        await createEntry(user.id, {
          description: body.description,
          type: body.type as AccountingEntryType,
          amountCents: body.amountCents,
          debitAccountId: body.debitAccountId,
          creditAccountId: body.creditAccountId,
          orderId:
            typeof body.orderId === "string" ? body.orderId : undefined,
          notes: typeof body.notes === "string" ? body.notes : undefined,
          entryDate:
            typeof body.entryDate === "string" ? body.entryDate : undefined,
          postImmediately: Boolean(body.postImmediately),
        }),
      );
      return true;
    }

    const postMatch = path.match(/^\/api\/accounting\/entries\/([^/]+)\/post$/);
    if (method === "PATCH" && postMatch) {
      const user = await requireStaff(req, [PlatformRole.PLATFORM_ADMIN]);
      json(
        res,
        200,
        await postEntry(decodeURIComponent(postMatch[1]), user.id),
      );
      return true;
    }

    const voidMatch = path.match(/^\/api\/accounting\/entries\/([^/]+)\/void$/);
    if (method === "PATCH" && voidMatch) {
      const user = await requireStaff(req, [PlatformRole.PLATFORM_ADMIN]);
      json(
        res,
        200,
        await voidEntry(
          decodeURIComponent(voidMatch[1]),
          user.id,
          user.platformRole,
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
    console.error("[accounting] owned error", error);
    json(res, 500, "Erro interno de accounting");
    return true;
  }
}
