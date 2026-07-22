/**
 * Phase 6–9: media service owns upload + list (+ delete) when MEDIA_OWNED≠0.
 * Local: Sharp variants. Cloudinary: when UPLOAD_PROVIDER=cloudinary.
 * Public URLs via MEDIA_PUBLIC_BASE_URL / buildMediaUrl.
 */
import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import Busboy from "busboy";
import { v2 as cloudinary } from "cloudinary";
import jwt from "jsonwebtoken";
import sharp from "sharp";
import {
  AUTH_COOKIE_NAME,
  buildMediaUrl,
  localVariantUrl,
  publicMediaUrl,
} from "@ishopine/shared";

const prisma = new PrismaClient();
const uploadDir = process.env.UPLOAD_DIR || "uploads";
const jwtSecret = process.env.JWT_SECRET || "";
const provider = (process.env.UPLOAD_PROVIDER || "local").toLowerCase();

if (provider === "cloudinary") {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

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

function withVariants<T extends { url: string }>(asset: T) {
  const url = publicMediaUrl(asset.url);
  return {
    ...asset,
    url,
    variants: {
      original: buildMediaUrl(asset.url),
      thumb: buildMediaUrl(asset.url, {
        width: 200,
        height: 200,
        crop: "fill",
        quality: "auto",
        format: "auto",
      }),
      card: buildMediaUrl(asset.url, {
        width: 640,
        crop: "fit",
        quality: "auto",
        format: "auto",
      }),
    },
  };
}

async function writeLocalVariants(absoluteOriginal: string, publicUrl: string) {
  const thumbAbs = join(
    process.cwd(),
    localVariantUrl(publicUrl, "thumb").replace(/^\//, ""),
  );
  const cardAbs = join(
    process.cwd(),
    localVariantUrl(publicUrl, "card").replace(/^\//, ""),
  );
  await Promise.all([
    sharp(absoluteOriginal)
      .rotate()
      .resize(200, 200, { fit: "cover" })
      .webp({ quality: 80 })
      .toFile(thumbAbs),
    sharp(absoluteOriginal)
      .rotate()
      .resize(640, undefined, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(cardAbs),
  ]);
}

function collectUpload(
  req: http.IncomingMessage,
  folder: string,
): Promise<{
  buffer: Buffer;
  mimeType: string;
  alt: string;
  sizeBytes: number;
}> {
  return new Promise((resolve, reject) => {
    const bb = Busboy({
      headers: req.headers,
      limits: { fileSize: 8 * 1024 * 1024 },
    });
    let settled = false;
    bb.on("file", (_name, file, info) => {
      const chunks: Buffer[] = [];
      file.on("data", (d: Buffer) => chunks.push(d));
      file.on("limit", () => {
        reject(new Error("Ficheiro demasiado grande (máx 8MB)"));
      });
      file.on("end", () => {
        if (settled) return;
        settled = true;
        const buffer = Buffer.concat(chunks);
        resolve({
          buffer,
          mimeType: info.mimeType,
          alt: info.filename,
          sizeBytes: buffer.length,
        });
      });
      file.on("error", reject);
    });
    bb.on("error", reject);
    bb.on("finish", () => {
      if (!settled) {
        reject(new Error("Ficheiro em falta (campo file)"));
      }
    });
    // folder unused here — kept for call-site clarity
    void folder;
    req.pipe(bb);
  });
}

async function uploadLocal(
  file: { buffer: Buffer; mimeType: string; alt: string; sizeBytes: number },
  folder: string,
) {
  const ext = (file.alt.split(".").pop() || "bin").replace(
    /[^a-zA-Z0-9]/g,
    "",
  );
  const filename = `${randomUUID()}.${ext || "bin"}`;
  const dir = join(process.cwd(), uploadDir, folder);
  await mkdir(dir, { recursive: true });
  const absolute = join(dir, filename);
  await writeFile(absolute, file.buffer);
  const url = `/uploads/${folder}/${filename}`;
  if (file.mimeType.startsWith("image/")) {
    try {
      await writeLocalVariants(absolute, url);
    } catch (error) {
      console.error("[media] sharp variants failed", error);
    }
  }
  return {
    url,
    provider: "local" as const,
    publicId: null as string | null,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    alt: file.alt,
  };
}

async function uploadCloudinary(
  file: { buffer: Buffer; mimeType: string; alt: string; sizeBytes: number },
  folder: string,
) {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    throw new Error(
      "Cloudinary não configurado (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET)",
    );
  }
  const result = await new Promise<{
    secure_url: string;
    public_id: string;
    bytes: number;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `ishopine/${folder}` },
      (error, uploadResult) => {
        if (error || !uploadResult) {
          reject(error ?? new Error("Falha no upload Cloudinary"));
          return;
        }
        resolve({
          secure_url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
          bytes: uploadResult.bytes,
        });
      },
    );
    stream.end(file.buffer);
  });
  return {
    url: result.secure_url,
    provider: "cloudinary" as const,
    publicId: result.public_id,
    mimeType: file.mimeType,
    sizeBytes: result.bytes,
    alt: file.alt,
  };
}

export async function handleOwnedMedia(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const path = pathOnly(req.url);

  // Phase 12: serve immutable local uploads with long cache (CDN-ready).
  if (req.method === "GET" && path.startsWith("/uploads/")) {
    const relative = decodeURIComponent(path.replace(/^\/uploads\//, ""));
    if (
      !relative ||
      relative.includes("..") ||
      relative.startsWith("/") ||
      relative.includes("\0")
    ) {
      json(res, 400, { message: "Path inválido" });
      return true;
    }
    const root = resolve(process.cwd(), uploadDir);
    const absolute = resolve(root, relative);
    if (!absolute.startsWith(root + sep) && absolute !== root) {
      json(res, 400, { message: "Path inválido" });
      return true;
    }
    if (!existsSync(absolute) || !statSync(absolute).isFile()) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Ficheiro não encontrado" }));
      return true;
    }
    const ext = extname(absolute).toLowerCase();
    const types: Record<string, string> = {
      ".webp": "image/webp",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".avif": "image/avif",
      ".svg": "image/svg+xml",
    };
    const cache =
      types[ext] != null
        ? "public, max-age=31536000, immutable"
        : "public, max-age=86400";
    res.writeHead(200, {
      "Content-Type": types[ext] || "application/octet-stream",
      "Cache-Control": cache,
      "X-Content-Type-Options": "nosniff",
    });
    createReadStream(absolute).pipe(res);
    return true;
  }

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
    json(res, 200, assets.map((a) => withVariants(a)));
    return true;
  }

  const deleteMatch = path.match(/^\/api\/(?:media|uploads)\/([^/]+)$/);
  if (req.method === "DELETE" && deleteMatch) {
    const user = verifyUser(req);
    if (!user) {
      json(res, 401, { message: "Não autenticado" });
      return true;
    }
    const asset = await prisma.mediaAsset.findUnique({
      where: { id: deleteMatch[1] },
    });
    if (!asset) {
      json(res, 404, { message: "Media não encontrado" });
      return true;
    }
    if (asset.uploadedById && asset.uploadedById !== user.sub) {
      json(res, 403, { message: "Sem permissão para apagar este media" });
      return true;
    }
    if (asset.provider === "local" && asset.url.startsWith("/uploads/")) {
      const absolute = join(process.cwd(), asset.url.replace(/^\//, ""));
      try {
        await unlink(absolute);
      } catch {
        // already gone
      }
      for (const variant of ["thumb", "card"] as const) {
        const v = join(
          process.cwd(),
          localVariantUrl(asset.url, variant).replace(/^\//, ""),
        );
        try {
          await unlink(v);
        } catch {
          // ignore
        }
      }
    }
    if (asset.provider === "cloudinary" && asset.publicId) {
      try {
        await cloudinary.uploader.destroy(asset.publicId);
      } catch {
        // ignore remote delete failures
      }
    }
    await prisma.mediaAsset.delete({ where: { id: asset.id } });
    json(res, 200, { ok: true });
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
      const file = await collectUpload(req, folder);
      const stored =
        provider === "cloudinary"
          ? await uploadCloudinary(file, folder)
          : await uploadLocal(file, folder);

      const created = await prisma.mediaAsset.create({
        data: {
          url: stored.url,
          publicId: stored.publicId,
          provider: stored.provider,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          folder,
          alt: stored.alt,
          uploadedById: user.sub,
          tenantId,
          shopId: shopId || null,
        },
      });
      json(res, 201, withVariants(created));
    } catch (error) {
      json(res, 400, {
        message:
          error instanceof Error ? error.message : "Upload falhou",
      });
    }
    return true;
  }

  return false;
}
