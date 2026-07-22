/**
 * Phase 22: comms owns /api/notifications, /api/conversations, /api/disputes
 * when COMMS_OWNED≠0. Nest outbox may still create notifications in-process.
 */
import http from "node:http";
import { DisputeStatus, PlatformRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME } from "@ishopine/shared";
import {
  HttpError,
  createDispute,
  listConversations,
  listDisputes,
  listMessages,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  prisma,
  resolveDispute,
  sendMessage,
  startConversation,
} from "./comms-core";

const jwtSecret = process.env.JWT_SECRET || "";

type JwtPayload = { sub: string };

const DISPUTE_STATUSES = new Set<string>(Object.values(DisputeStatus));

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

function isCommsPath(path: string) {
  return (
    path.startsWith("/api/notifications") ||
    path.startsWith("/api/conversations") ||
    path.startsWith("/api/disputes")
  );
}

export async function handleOwnedComms(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const path = pathOnly(req.url);
  const method = (req.method || "GET").toUpperCase();

  if (!isCommsPath(path)) return false;

  try {
    /* ── Notifications ────────────────────────────────────── */
    if (method === "GET" && path === "/api/notifications") {
      const user = await requireAuth(req);
      json(res, 200, await listNotifications(user.id));
      return true;
    }
    if (method === "PATCH" && path === "/api/notifications/read-all") {
      const user = await requireAuth(req);
      json(res, 200, await markAllNotificationsRead(user.id));
      return true;
    }
    const noteReadMatch = path.match(
      /^\/api\/notifications\/([^/]+)\/read$/,
    );
    if (method === "PATCH" && noteReadMatch) {
      const user = await requireAuth(req);
      json(
        res,
        200,
        await markNotificationRead(
          user.id,
          decodeURIComponent(noteReadMatch[1]),
        ),
      );
      return true;
    }

    /* ── Conversations / messages ─────────────────────────── */
    if (method === "GET" && path === "/api/conversations") {
      const user = await requireAuth(req);
      json(res, 200, await listConversations(user.id));
      return true;
    }
    if (method === "POST" && path === "/api/conversations") {
      const user = await requireAuth(req);
      const body = await readJsonBody(req);
      if (typeof body.shopId !== "string") {
        throw new HttpError(400, "shopId obrigatório");
      }
      json(
        res,
        201,
        await startConversation(user.id, {
          shopId: body.shopId,
          productId:
            typeof body.productId === "string" ? body.productId : undefined,
          subject:
            typeof body.subject === "string" ? body.subject : undefined,
        }),
      );
      return true;
    }
    const msgsMatch = path.match(
      /^\/api\/conversations\/([^/]+)\/messages$/,
    );
    if (method === "GET" && msgsMatch) {
      const user = await requireAuth(req);
      json(
        res,
        200,
        await listMessages(decodeURIComponent(msgsMatch[1]), user.id),
      );
      return true;
    }
    if (method === "POST" && msgsMatch) {
      const user = await requireAuth(req);
      const body = await readJsonBody(req);
      if (typeof body.body !== "string" || !body.body.trim()) {
        throw new HttpError(400, "body obrigatório");
      }
      json(
        res,
        201,
        await sendMessage(
          decodeURIComponent(msgsMatch[1]),
          user.id,
          body.body,
        ),
      );
      return true;
    }

    /* ── Disputes ─────────────────────────────────────────── */
    if (method === "POST" && path === "/api/disputes") {
      const user = await requireAuth(req);
      const body = await readJsonBody(req);
      if (typeof body.orderId !== "string") {
        throw new HttpError(400, "orderId obrigatório");
      }
      if (typeof body.reason !== "string") {
        throw new HttpError(400, "reason obrigatório");
      }
      if (typeof body.description !== "string") {
        throw new HttpError(400, "description obrigatório");
      }
      json(
        res,
        201,
        await createDispute(user.id, {
          orderId: body.orderId,
          reason: body.reason,
          description: body.description,
        }),
      );
      return true;
    }
    if (method === "GET" && path === "/api/disputes") {
      const user = await requireAuth(req);
      json(res, 200, await listDisputes(user.id, user.platformRole));
      return true;
    }
    const resolveMatch = path.match(/^\/api\/disputes\/([^/]+)\/resolve$/);
    if (method === "PATCH" && resolveMatch) {
      const user = await requireAuth(req);
      if (
        user.platformRole !== PlatformRole.PLATFORM_ADMIN &&
        user.platformRole !== PlatformRole.PLATFORM_OPERATOR
      ) {
        throw new HttpError(403, "Acesso não autorizado para este perfil");
      }
      const body = await readJsonBody(req);
      if (typeof body.status !== "string" || !DISPUTE_STATUSES.has(body.status)) {
        throw new HttpError(400, "status inválido");
      }
      if (typeof body.resolution !== "string") {
        throw new HttpError(400, "resolution obrigatório");
      }
      json(
        res,
        200,
        await resolveDispute(
          decodeURIComponent(resolveMatch[1]),
          body.status as DisputeStatus,
          body.resolution,
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
    console.error("[comms] owned error", error);
    json(res, 500, "Erro interno de comms");
    return true;
  }
}
