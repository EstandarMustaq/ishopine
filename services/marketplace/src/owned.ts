/**
 * Phase 18: marketplace owns shops + ads + wishlist when MARKETPLACE_OWNED≠0.
 * Product reviews stay Nest via catalog fallthrough (/api/products/:id/reviews).
 */
import http from "node:http";
import {
  AdSlot,
  AdStatus,
  PlatformRole,
  ShopStatus,
  ShopType,
  TenantType,
} from "@prisma/client";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME, TENANT_HEADER } from "@ishopine/shared";
import {
  HttpError,
  addWishlist,
  createAd,
  createShop,
  ensureAccountForUser,
  followShop,
  getShopBySlug,
  isFollowingShop,
  listAdminAds,
  listPublicAds,
  listPublicShops,
  listWishlist,
  myShops,
  prisma,
  removeAd,
  removeWishlist,
  resolveTenantAccess,
  unfollowShop,
  updateAd,
  updateShop,
} from "./marketplace-core";

const jwtSecret = process.env.JWT_SECRET || "";
const orgSlug = process.env.PLATFORM_ORG_SLUG || "ishopine";
const isProd = process.env.NODE_ENV === "production";

type JwtPayload = { sub: string; tfa?: boolean };

const SHOP_TYPES = new Set<string>(Object.values(ShopType));
const SHOP_STATUSES = new Set<string>(Object.values(ShopStatus));
const AD_SLOTS = new Set<string>(Object.values(AdSlot));
const AD_STATUSES = new Set<string>(Object.values(AdStatus));

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
  user: { totpEnabled: boolean; platformRole: PlatformRole },
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

async function requirePlatformStaff(
  req: http.IncomingMessage,
  roles: PlatformRole[] = [
    PlatformRole.PLATFORM_ADMIN,
    PlatformRole.PLATFORM_OPERATOR,
  ],
) {
  const { jwt: payload, user } = await requireAuth(req);
  if (!roles.includes(user.platformRole)) {
    throw new HttpError(403, "Acesso não autorizado para este perfil");
  }
  await assertStaff2fa(user, payload.tfa);
  return user;
}

async function requireSellerTenant(
  req: http.IncomingMessage,
  allowed: TenantType[],
) {
  const { user } = await requireAuth(req);
  const tenantId = headerValue(req, TENANT_HEADER);
  const isStaff =
    user.platformRole === PlatformRole.PLATFORM_ADMIN ||
    user.platformRole === PlatformRole.PLATFORM_OPERATOR;

  if (!tenantId) {
    if (isStaff) throw new HttpError(400, "Tenant em falta para esta operação");
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
  return { userId: user.id, tenant };
}

function isMarketplacePath(path: string) {
  return (
    path.startsWith("/api/shops") ||
    path.startsWith("/api/ads") ||
    path.startsWith("/api/wishlist")
  );
}

export async function handleOwnedMarketplace(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const path = pathOnly(req.url);
  const method = (req.method || "GET").toUpperCase();

  if (!isMarketplacePath(path)) return false;

  try {
    /* ── Wishlist ─────────────────────────────────────────── */
    if (method === "GET" && path === "/api/wishlist") {
      const { user } = await requireAuth(req);
      json(res, 200, await listWishlist(user.id));
      return true;
    }
    if (method === "POST" && path === "/api/wishlist") {
      const { user } = await requireAuth(req);
      const body = await readJsonBody(req);
      if (typeof body.productId !== "string") {
        throw new HttpError(400, "productId obrigatório");
      }
      json(res, 201, await addWishlist(user.id, body.productId));
      return true;
    }
    const wishMatch = path.match(/^\/api\/wishlist\/([^/]+)$/);
    if (method === "DELETE" && wishMatch) {
      const { user } = await requireAuth(req);
      json(
        res,
        200,
        await removeWishlist(user.id, decodeURIComponent(wishMatch[1])),
      );
      return true;
    }

    /* ── Ads ──────────────────────────────────────────────── */
    if (method === "GET" && path === "/api/ads") {
      const q = queryAll(req.url);
      const slot =
        q.slot && AD_SLOTS.has(q.slot) ? (q.slot as AdSlot) : undefined;
      json(res, 200, await listPublicAds(slot));
      return true;
    }
    if (method === "GET" && path === "/api/ads/admin") {
      await requirePlatformStaff(req);
      json(res, 200, await listAdminAds());
      return true;
    }
    if (method === "POST" && path === "/api/ads") {
      await requirePlatformStaff(req, [PlatformRole.PLATFORM_ADMIN]);
      const body = await readJsonBody(req);
      if (
        typeof body.title !== "string" ||
        typeof body.imageUrl !== "string" ||
        typeof body.linkUrl !== "string"
      ) {
        throw new HttpError(400, "Título, imagem e link são obrigatórios");
      }
      const created = await createAd({
        title: body.title,
        subtitle: typeof body.subtitle === "string" ? body.subtitle : undefined,
        imageUrl: body.imageUrl,
        linkUrl: body.linkUrl,
        slot:
          typeof body.slot === "string" && AD_SLOTS.has(body.slot)
            ? (body.slot as AdSlot)
            : undefined,
        status:
          typeof body.status === "string" && AD_STATUSES.has(body.status)
            ? (body.status as AdStatus)
            : undefined,
        priority: body.priority != null ? Number(body.priority) : undefined,
        startsAt: typeof body.startsAt === "string" ? body.startsAt : undefined,
        endsAt: typeof body.endsAt === "string" ? body.endsAt : undefined,
        shopId: typeof body.shopId === "string" ? body.shopId : undefined,
      });
      json(res, 201, created);
      return true;
    }
    const adMatch = path.match(/^\/api\/ads\/([^/]+)$/);
    if (method === "PATCH" && adMatch) {
      await requirePlatformStaff(req, [PlatformRole.PLATFORM_ADMIN]);
      const body = await readJsonBody(req);
      json(
        res,
        200,
        await updateAd(decodeURIComponent(adMatch[1]), {
          title: typeof body.title === "string" ? body.title : undefined,
          subtitle:
            body.subtitle === null
              ? null
              : typeof body.subtitle === "string"
                ? body.subtitle
                : undefined,
          imageUrl:
            typeof body.imageUrl === "string" ? body.imageUrl : undefined,
          linkUrl: typeof body.linkUrl === "string" ? body.linkUrl : undefined,
          slot:
            typeof body.slot === "string" && AD_SLOTS.has(body.slot)
              ? (body.slot as AdSlot)
              : undefined,
          status:
            typeof body.status === "string" && AD_STATUSES.has(body.status)
              ? (body.status as AdStatus)
              : undefined,
          priority: body.priority != null ? Number(body.priority) : undefined,
          startsAt:
            body.startsAt === null
              ? null
              : typeof body.startsAt === "string"
                ? body.startsAt
                : undefined,
          endsAt:
            body.endsAt === null
              ? null
              : typeof body.endsAt === "string"
                ? body.endsAt
                : undefined,
          shopId:
            body.shopId === null
              ? null
              : typeof body.shopId === "string"
                ? body.shopId
                : undefined,
        }),
      );
      return true;
    }
    if (method === "DELETE" && adMatch) {
      await requirePlatformStaff(req, [PlatformRole.PLATFORM_ADMIN]);
      json(res, 200, await removeAd(decodeURIComponent(adMatch[1])));
      return true;
    }

    /* ── Shops ────────────────────────────────────────────── */
    if (method === "GET" && path === "/api/shops") {
      json(res, 200, await listPublicShops(queryAll(req.url)));
      return true;
    }
    if (method === "GET" && path === "/api/shops/mine") {
      const { userId } = await requireSellerTenant(req, [
        TenantType.PARTICULAR,
        TenantType.STORE,
      ]);
      json(res, 200, await myShops(userId));
      return true;
    }
    if (method === "POST" && path === "/api/shops") {
      const { user } = await requireAuth(req);
      const body = await readJsonBody(req);
      if (typeof body.name !== "string") {
        throw new HttpError(400, "Nome obrigatório");
      }
      const created = await createShop(user.id, {
        name: body.name,
        description:
          typeof body.description === "string" ? body.description : undefined,
        shopType:
          typeof body.shopType === "string" && SHOP_TYPES.has(body.shopType)
            ? (body.shopType as ShopType)
            : undefined,
        province: String(body.province ?? ""),
        district: String(body.district ?? ""),
        latitude: Number(body.latitude),
        longitude: Number(body.longitude),
        logoUrl: typeof body.logoUrl === "string" ? body.logoUrl : undefined,
        bannerUrl:
          typeof body.bannerUrl === "string" ? body.bannerUrl : undefined,
      });
      json(res, 201, created);
      return true;
    }

    const followMatch = path.match(/^\/api\/shops\/([^/]+)\/follow$/);
    if (method === "POST" && followMatch) {
      const { user } = await requireAuth(req);
      json(
        res,
        200,
        await followShop(user.id, decodeURIComponent(followMatch[1])),
      );
      return true;
    }
    if (method === "DELETE" && followMatch) {
      const { user } = await requireAuth(req);
      json(
        res,
        200,
        await unfollowShop(user.id, decodeURIComponent(followMatch[1])),
      );
      return true;
    }
    const followingMatch = path.match(/^\/api\/shops\/([^/]+)\/following$/);
    if (method === "GET" && followingMatch) {
      const { user } = await requireAuth(req);
      json(
        res,
        200,
        await isFollowingShop(user.id, decodeURIComponent(followingMatch[1])),
      );
      return true;
    }

    const shopIdMatch = path.match(/^\/api\/shops\/([^/]+)$/);
    if (method === "PATCH" && shopIdMatch) {
      const { userId } = await requireSellerTenant(req, [TenantType.STORE]);
      const body = await readJsonBody(req);
      const patch: Parameters<typeof updateShop>[2] = {};
      if (typeof body.name === "string") patch.name = body.name;
      if (typeof body.description === "string") patch.description = body.description;
      if (typeof body.logoUrl === "string") patch.logoUrl = body.logoUrl;
      if (typeof body.bannerUrl === "string") patch.bannerUrl = body.bannerUrl;
      if (typeof body.policiesText === "string") {
        patch.policiesText = body.policiesText;
      }
      if (body.hoursJson && typeof body.hoursJson === "object") {
        patch.hoursJson = body.hoursJson as Record<string, string>;
      }
      if (typeof body.shopType === "string" && SHOP_TYPES.has(body.shopType)) {
        patch.shopType = body.shopType as ShopType;
      }
      if (typeof body.province === "string") patch.province = body.province;
      if (typeof body.district === "string") patch.district = body.district;
      if (body.latitude != null) patch.latitude = Number(body.latitude);
      if (body.longitude != null) patch.longitude = Number(body.longitude);
      if (
        typeof body.status === "string" &&
        SHOP_STATUSES.has(body.status)
      ) {
        patch.status = body.status as ShopStatus;
      }
      json(
        res,
        200,
        await updateShop(decodeURIComponent(shopIdMatch[1]), userId, patch),
      );
      return true;
    }
    if (method === "GET" && shopIdMatch) {
      json(
        res,
        200,
        await getShopBySlug(decodeURIComponent(shopIdMatch[1])),
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
    console.error("[marketplace] owned error", error);
    json(res, 500, "Erro interno de marketplace");
    return true;
  }
}
