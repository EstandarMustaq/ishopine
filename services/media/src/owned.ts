/**
 * Phase 6: media service owns upload + list when MEDIA_OWNED≠0.
 * Auth via JWT (Bearer or ishopine_session cookie); metadata in shared Prisma DB.
 */
import http from "node:http";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import Busboy from "busboy";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME } from "@ishopine/shared";

const prisma = new PrismaClient();
const uploadDir = process.env.UPLOAD_DIR || "uploads";
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

function verifyUser(req: http.IncomingMessage): JwtPayload | null {
  const token = extractToken(req);
  if (!token || !jwtSecret) return null;
  try {
    return jwt.verify(token, jwtSecret) as JwtPayload;
  } catch {
    return null;
  }
}

function json(
  res: http.ServerResponse,
  status: number,
  body: unknown,
) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function pathOnly(url?: string) {
  return (url || "/").split("?")[0];
}

export async function handleOwnedMedia(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const path = pathOnly(req.url);

  if (req.method === "GET" && (path === "/api/media" || path === "/api/uploads")) {
    const user = verifyUser(req);
    if (!user) {
      json(res, 401, { message: "Não autenticado" });
      return true;
    }
    const url = new URL(req.url || "/", "http://local");
    const folder = url.searchParams.get("folder") || undefined;
    const tenantId = req.headers["x-tenant-id"];
    const assets = await prisma.mediaAsset.findMany({
      where: {
        uploadedById: user.sub,
        ...(folder ? { folder } : {}),
        ...(typeof tenantId === "string" && tenantId
          ? { tenantId }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    json(res, 200, assets);
    return true;
  }

  if (
    req.method === "POST" &&
    (path === "/api/media" || path === "/api/uploads")
  ) {
    const user = verifyUser(req);
    if (!user) {
      json(res, 401, { message: "Não autenticado" });
      return true;
    }

    const url = new URL(req.url || "/", "http://local");
    const folder = url.searchParams.get("folder") || "products";
    const shopId = url.searchParams.get("shopId");
    const tenantHeader = req.headers["x-tenant-id"];
    const tenantId =
      typeof tenantHeader === "string" && tenantHeader
        ? tenantHeader
        : null;

    try {
      const asset = await new Promise<{
        url: string;
        mimeType: string;
        sizeBytes: number;
        alt: string;
      }>((resolve, reject) => {
        const bb = Busboy({
          headers: req.headers,
          limits: { fileSize: 8 * 1024 * 1024 },
        });
        let settled = false;
        bb.on("file", (_name, file, info) => {
          const ext = (info.filename.split(".").pop() || "bin").replace(
            /[^a-zA-Z0-9]/g,
            "",
          );
          const filename = `${randomUUID()}.${ext || "bin"}`;
          const dir = join(process.cwd(), uploadDir, folder);
          void mkdir(dir, { recursive: true }).then(() => {
            const absolute = join(dir, filename);
            const out = createWriteStream(absolute);
            let size = 0;
            file.on("data", (d: Buffer) => {
              size += d.length;
            });
            file.pipe(out);
            out.on("finish", () => {
              if (settled) return;
              settled = true;
              resolve({
                url: `/uploads/${folder}/${filename}`,
                mimeType: info.mimeType,
                sizeBytes: size,
                alt: info.filename,
              });
            });
            out.on("error", reject);
          });
        });
        bb.on("error", reject);
        bb.on("finish", () => {
          if (!settled) {
            reject(new Error("Ficheiro em falta (campo file)"));
          }
        });
        req.pipe(bb);
      });

      const created = await prisma.mediaAsset.create({
        data: {
          url: asset.url,
          provider: "local",
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
          folder,
          alt: asset.alt,
          uploadedById: user.sub,
          tenantId,
          shopId: shopId || null,
        },
      });
      json(res, 201, created);
    } catch (error) {
      json(res, 400, {
        message:
          error instanceof Error ? error.message : "Upload falhou",
      });
    }
    return true;
  }

  // Other media routes (DELETE, etc.) → upstream Nest for now.
  return false;
}
