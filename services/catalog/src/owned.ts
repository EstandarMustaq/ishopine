/**
 * Phase 17: catalog owns categories/products (+ seller/admin) when CATALOG_OWNED≠0.
 */
import http from "node:http";
import {
  CategoryScope,
  PlatformRole,
  ProductStatus,
  TenantType,
} from "@prisma/client";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME, TENANT_HEADER } from "@ishopine/shared";
import {
  HttpError,
  addProductImage,
  assertCatalog2fa,
  createCategory,
  createProduct,
  createStoreCategory,
  deleteProduct,
  ensureAccountForUser,
  getProduct,
  listCategories,
  listProducts,
  listSellerProducts,
  loadUser,
  resolveTenantAccess,
  type TenantCtx,
  updateProduct,
} from "./catalog-core";

const jwtSecret = process.env.JWT_SECRET || "";

type JwtPayload = { sub: string; tfa?: boolean; platformRole?: PlatformRole };

const PRODUCT_STATUSES = new Set<string>(Object.values(ProductStatus));
const CATEGORY_SCOPES = new Set<string>(Object.values(CategoryScope));

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
  for (const [k, v] of new URLSearchParams(q).entries()) {
    out[k] = v;
  }
  return out;
}

function headerValue(
  req: http.IncomingMessage,
  name: string,
): string | undefined {
  const raw = req.headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0];
  return raw;
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
  const user = await loadUser(payload.sub);
  if (!user) throw new HttpError(401, "Não autenticado");
  return { jwt: payload, user };
}

async function requireSellerTenant(
  req: http.IncomingMessage,
  allowed: TenantType[],
): Promise<{ userId: string; tenant: TenantCtx; tfa?: boolean }> {
  const { jwt: payload, user } = await requireAuth(req);
  await assertCatalog2fa(user, payload.tfa);

  const tenantId = headerValue(req, TENANT_HEADER);
  const isStaff =
    user.platformRole === PlatformRole.PLATFORM_ADMIN ||
    user.platformRole === PlatformRole.PLATFORM_OPERATOR;

  if (!tenantId) {
    if (isStaff) {
      throw new HttpError(400, "Tenant em falta para esta operação");
    }
    throw new HttpError(
      403,
      `Cabeçalho ${TENANT_HEADER} é obrigatório neste recurso`,
    );
  }

  const account = await ensureAccountForUser(user.id);
  const tenant = await resolveTenantAccess(account.id, tenantId);
  if (allowed.length && !allowed.includes(tenant.tenantType)) {
    throw new HttpError(
      403,
      `Este recurso só aceita tenant: ${allowed.join(", ")}`,
    );
  }
  return { userId: user.id, tenant, tfa: payload.tfa };
}

async function requirePlatformStaff(req: http.IncomingMessage) {
  const { jwt: payload, user } = await requireAuth(req);
  if (
    user.platformRole !== PlatformRole.PLATFORM_ADMIN &&
    user.platformRole !== PlatformRole.PLATFORM_OPERATOR
  ) {
    throw new HttpError(403, "Acesso não autorizado para este perfil");
  }
  await assertCatalog2fa(user, payload.tfa);
  return user;
}

function isCatalogPath(path: string) {
  return (
    path.startsWith("/api/categories") ||
    path.startsWith("/api/products") ||
    path.startsWith("/api/seller/categories") ||
    path.startsWith("/api/seller/products") ||
    path.startsWith("/api/admin/products")
  );
}

export async function handleOwnedCatalog(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const path = pathOnly(req.url);
  const method = (req.method || "GET").toUpperCase();

  if (!isCatalogPath(path)) {
    return false;
  }

  try {
    if (method === "GET" && path === "/api/categories") {
      const q = queryAll(req.url);
      json(res, 200, await listCategories(q));
      return true;
    }

    if (method === "POST" && path === "/api/categories") {
      await requirePlatformStaff(req);
      const body = await readJsonBody(req);
      if (typeof body.name !== "string" || !body.name.trim()) {
        throw new HttpError(400, "Nome obrigatório");
      }
      const scope =
        typeof body.scope === "string" && CATEGORY_SCOPES.has(body.scope)
          ? (body.scope as CategoryScope)
          : undefined;
      const created = await createCategory({
        name: body.name,
        description:
          typeof body.description === "string" ? body.description : undefined,
        imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : undefined,
        parentId: typeof body.parentId === "string" ? body.parentId : undefined,
        sortOrder:
          typeof body.sortOrder === "number"
            ? body.sortOrder
            : body.sortOrder != null
              ? Number(body.sortOrder)
              : undefined,
        scope,
        shopId: typeof body.shopId === "string" ? body.shopId : undefined,
      });
      json(res, 201, created);
      return true;
    }

    if (method === "POST" && path === "/api/seller/categories") {
      const { userId, tenant } = await requireSellerTenant(req, [
        TenantType.STORE,
      ]);
      const body = await readJsonBody(req);
      if (typeof body.name !== "string" || !body.name.trim()) {
        throw new HttpError(400, "Nome obrigatório");
      }
      const created = await createStoreCategory(userId, tenant, {
        name: body.name,
        description:
          typeof body.description === "string" ? body.description : undefined,
        imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : undefined,
        parentId: typeof body.parentId === "string" ? body.parentId : undefined,
        sortOrder:
          typeof body.sortOrder === "number"
            ? body.sortOrder
            : body.sortOrder != null
              ? Number(body.sortOrder)
              : undefined,
      });
      json(res, 201, created);
      return true;
    }

    if (method === "GET" && path === "/api/products") {
      const q = queryAll(req.url);
      const status =
        q.status && PRODUCT_STATUSES.has(q.status)
          ? (q.status as ProductStatus)
          : undefined;
      json(res, 200, await listProducts({ ...q, status }));
      return true;
    }

    if (method === "GET" && path === "/api/admin/products") {
      const user = await requirePlatformStaff(req);
      const q = queryAll(req.url);
      const status =
        q.status && PRODUCT_STATUSES.has(q.status)
          ? (q.status as ProductStatus)
          : undefined;
      json(
        res,
        200,
        await listProducts({
          ...q,
          status,
          platformRole: user.platformRole,
        }),
      );
      return true;
    }

    if (method === "GET" && path === "/api/seller/products") {
      const { userId, tenant } = await requireSellerTenant(req, [
        TenantType.PARTICULAR,
        TenantType.STORE,
      ]);
      const q = queryAll(req.url);
      const status =
        q.status && PRODUCT_STATUSES.has(q.status)
          ? (q.status as ProductStatus)
          : undefined;
      json(res, 200, await listSellerProducts(userId, tenant, { ...q, status }));
      return true;
    }

    const productMatch = path.match(/^\/api\/products\/([^/]+)$/);
    if (method === "GET" && productMatch) {
      json(res, 200, await getProduct(decodeURIComponent(productMatch[1])));
      return true;
    }

    if (method === "POST" && path === "/api/products") {
      const { userId, tenant } = await requireSellerTenant(req, [
        TenantType.PARTICULAR,
        TenantType.STORE,
      ]);
      const body = await readJsonBody(req);
      if (typeof body.name !== "string" || typeof body.description !== "string") {
        throw new HttpError(400, "name e description obrigatórios");
      }
      const priceCents = Number(body.priceCents);
      if (!Number.isFinite(priceCents)) {
        throw new HttpError(400, "priceCents inválido");
      }
      const status =
        typeof body.status === "string" && PRODUCT_STATUSES.has(body.status)
          ? (body.status as ProductStatus)
          : undefined;
      const created = await createProduct(
        userId,
        {
          shopId: typeof body.shopId === "string" ? body.shopId : undefined,
          name: body.name,
          description: body.description,
          shortDescription:
            typeof body.shortDescription === "string"
              ? body.shortDescription
              : undefined,
          priceCents,
          compareAtCents:
            body.compareAtCents != null ? Number(body.compareAtCents) : undefined,
          costCents: body.costCents != null ? Number(body.costCents) : undefined,
          stock: body.stock != null ? Number(body.stock) : undefined,
          status,
          categoryId:
            typeof body.categoryId === "string" ? body.categoryId : undefined,
          brand: typeof body.brand === "string" ? body.brand : undefined,
          material:
            typeof body.material === "string" ? body.material : undefined,
          dimensions:
            typeof body.dimensions === "string" ? body.dimensions : undefined,
          weightKg: body.weightKg != null ? Number(body.weightKg) : undefined,
          color: typeof body.color === "string" ? body.color : undefined,
          condition:
            typeof body.condition === "string" ? body.condition : undefined,
          featured: typeof body.featured === "boolean" ? body.featured : undefined,
          sku: typeof body.sku === "string" ? body.sku : undefined,
          images: Array.isArray(body.images)
            ? (body.images as Array<Record<string, unknown>>)
                .filter((img) => typeof img.url === "string")
                .map((img) => ({
                  url: img.url as string,
                  publicId:
                    typeof img.publicId === "string" ? img.publicId : undefined,
                  alt: typeof img.alt === "string" ? img.alt : undefined,
                  isPrimary:
                    typeof img.isPrimary === "boolean" ? img.isPrimary : undefined,
                }))
            : undefined,
        },
        tenant,
      );
      json(res, 201, created);
      return true;
    }

    if (method === "PATCH" && productMatch) {
      const { userId, tenant } = await requireSellerTenant(req, [
        TenantType.PARTICULAR,
        TenantType.STORE,
      ]);
      const body = await readJsonBody(req);
      const patch: Record<string, unknown> = {};
      for (const key of [
        "name",
        "description",
        "shortDescription",
        "brand",
        "material",
        "dimensions",
        "color",
        "condition",
      ] as const) {
        if (typeof body[key] === "string") patch[key] = body[key];
      }
      for (const key of [
        "priceCents",
        "costCents",
        "stock",
        "weightKg",
      ] as const) {
        if (body[key] != null) patch[key] = Number(body[key]);
      }
      if (body.compareAtCents === null) patch.compareAtCents = null;
      else if (body.compareAtCents != null) {
        patch.compareAtCents = Number(body.compareAtCents);
      }
      if (body.categoryId === null) patch.categoryId = null;
      else if (typeof body.categoryId === "string") {
        patch.categoryId = body.categoryId;
      }
      if (typeof body.featured === "boolean") patch.featured = body.featured;
      if (
        typeof body.status === "string" &&
        PRODUCT_STATUSES.has(body.status)
      ) {
        patch.status = body.status;
      }
      const updated = await updateProduct(
        decodeURIComponent(productMatch[1]),
        userId,
        patch as Parameters<typeof updateProduct>[2],
        tenant,
      );
      json(res, 200, updated);
      return true;
    }

    const imageMatch = path.match(/^\/api\/products\/([^/]+)\/images$/);
    if (method === "POST" && imageMatch) {
      const { userId, tenant } = await requireSellerTenant(req, [
        TenantType.PARTICULAR,
        TenantType.STORE,
      ]);
      const body = await readJsonBody(req);
      if (typeof body.url !== "string") {
        throw new HttpError(400, "url obrigatório");
      }
      const created = await addProductImage(
        decodeURIComponent(imageMatch[1]),
        userId,
        {
          url: body.url,
          publicId:
            typeof body.publicId === "string" ? body.publicId : undefined,
          alt: typeof body.alt === "string" ? body.alt : undefined,
          isPrimary:
            typeof body.isPrimary === "boolean" ? body.isPrimary : undefined,
        },
        tenant,
      );
      json(res, 201, created);
      return true;
    }

    if (method === "DELETE" && productMatch) {
      const { userId, tenant } = await requireSellerTenant(req, [
        TenantType.PARTICULAR,
        TenantType.STORE,
      ]);
      json(
        res,
        200,
        await deleteProduct(
          decodeURIComponent(productMatch[1]),
          userId,
          tenant,
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
    console.error("[catalog] owned error", error);
    json(res, 500, "Erro interno de catalog");
    return true;
  }
}
