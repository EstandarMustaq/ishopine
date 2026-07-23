/**
 * Phase 24: reviews owns GET|POST /api/products/:id/reviews when REVIEWS_OWNED≠0.
 * Gateway routes these via pathRe before the broader /api/products → catalog.
 */
import http from "node:http";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME } from "@ishopine/shared";
import {
  HttpError,
  createReview,
  listForProduct,
  prisma,
} from "./reviews-core";

const jwtSecret = process.env.JWT_SECRET || "";

type JwtPayload = { sub: string };

const REVIEWS_PATH = /^\/api\/products\/([^/]+)\/reviews\/?$/;

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
    select: { id: true },
  });
  if (!user) throw new HttpError(401, "Não autenticado");
  return user;
}

export async function handleOwnedReviews(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const path = pathOnly(req.url);
  const method = (req.method || "GET").toUpperCase();
  const match = path.match(REVIEWS_PATH);
  if (!match) return false;

  const productId = decodeURIComponent(match[1]);

  try {
    if (method === "GET") {
      json(res, 200, await listForProduct(productId));
      return true;
    }

    if (method === "POST") {
      const user = await requireAuth(req);
      const body = await readJsonBody(req);
      if (typeof body.rating !== "number" || !Number.isFinite(body.rating)) {
        throw new HttpError(400, "rating obrigatório");
      }
      json(
        res,
        201,
        await createReview(user.id, productId, {
          rating: body.rating,
          title: typeof body.title === "string" ? body.title : undefined,
          comment: typeof body.comment === "string" ? body.comment : undefined,
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
    console.error("[reviews] owned error", error);
    json(res, 500, "Erro interno");
    return true;
  }
}
