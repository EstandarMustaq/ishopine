/**
 * Phase 18: marketplace domain — shops, ads, wishlist (Nest parity).
 */
import {
  AdSlot,
  AdStatus,
  PlatformRole,
  Prisma,
  PrismaClient,
  ProductStatus,
  ShopRole,
  ShopStatus,
  ShopType,
  TenantMemberRole,
  TenantType,
} from "@prisma/client";
import { isValidMzLocation } from "./mz";

export const prisma = new PrismaClient();
const orgSlug = process.env.PLATFORM_ORG_SLUG || "ishopine";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export type TenantCtx = {
  tenantId: string;
  tenantType: TenantType;
  tenantSlug: string;
  membershipRole: TenantMemberRole;
  shopId: string | null;
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function reputationFrom(ratingAvg: number, ratingCount: number, followers = 0) {
  return Math.min(
    100,
    Math.round(
      ratingAvg * 18 + Math.min(ratingCount, 40) * 0.5 + Math.min(followers, 50) * 0.2,
    ),
  );
}

async function organizationId() {
  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) throw new HttpError(404, "Organização da plataforma não encontrada");
  return org.id;
}

function assertGeo(data: {
  province?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
}) {
  if (
    !data.province ||
    !data.district ||
    typeof data.latitude !== "number" ||
    typeof data.longitude !== "number" ||
    !Number.isFinite(data.latitude) ||
    !Number.isFinite(data.longitude)
  ) {
    throw new HttpError(
      400,
      "Província, distrito e geolocalização são obrigatórios",
    );
  }
  if (!isValidMzLocation(data.province, data.district)) {
    throw new HttpError(400, "Província ou distrito inválido em Moçambique");
  }
  if (
    data.latitude < -27.5 ||
    data.latitude > -10 ||
    data.longitude < 30 ||
    data.longitude > 41
  ) {
    throw new HttpError(400, "Coordenadas fora de Moçambique");
  }
}

export async function ensureAccountForUser(userId: string) {
  const existing = await prisma.account.findUnique({ where: { userId } });
  if (existing) return existing;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, "Utilizador não encontrado");
  return prisma.account.create({
    data: {
      userId: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
    },
  });
}

export async function resolveTenantAccess(
  accountId: string,
  tenantId: string,
): Promise<TenantCtx> {
  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_accountId: { tenantId, accountId } },
    include: { tenant: true },
  });
  if (!membership?.isActive || !membership.tenant.isActive) {
    throw new HttpError(403, "Sem acesso a este tenant");
  }
  return {
    tenantId: membership.tenant.id,
    tenantType: membership.tenant.type,
    tenantSlug: membership.tenant.slug,
    membershipRole: membership.role,
    shopId: membership.tenant.shopId,
  };
}

async function createStoreTenant(
  accountId: string,
  input: { name: string; shopId?: string },
) {
  if (input.shopId) {
    const linked = await prisma.tenant.findUnique({
      where: { shopId: input.shopId },
    });
    if (linked) return linked;
  }
  let slug = `s-${slugify(input.name)}`;
  let i = 0;
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    i += 1;
    slug = `s-${slugify(input.name)}-${i}`;
  }
  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        type: TenantType.STORE,
        name: input.name.trim(),
        slug,
        ownerAccountId: accountId,
        shopId: input.shopId,
      },
    });
    await tx.tenantMembership.create({
      data: {
        tenantId: tenant.id,
        accountId,
        role: TenantMemberRole.OWNER,
      },
    });
    return tenant;
  });
}

export async function createShop(
  userId: string,
  data: {
    name: string;
    description?: string;
    shopType?: ShopType;
    province: string;
    district: string;
    latitude: number;
    longitude: number;
    logoUrl?: string;
    bannerUrl?: string;
  },
) {
  assertGeo(data);
  const organizationIdValue = await organizationId();
  let slug = slugify(data.name);
  const clash = await prisma.shop.findUnique({
    where: {
      organizationId_slug: { organizationId: organizationIdValue, slug },
    },
  });
  if (clash) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const shop = await prisma.$transaction(async (tx) => {
    const created = await tx.shop.create({
      data: {
        organizationId: organizationIdValue,
        ownerId: userId,
        name: data.name,
        slug,
        description: data.description,
        shopType: data.shopType ?? ShopType.OTHER,
        province: data.province,
        district: data.district,
        latitude: data.latitude,
        longitude: data.longitude,
        logoUrl: data.logoUrl,
        bannerUrl: data.bannerUrl,
        status: ShopStatus.ACTIVE,
        reputationScore: 10,
        members: {
          create: { userId, role: ShopRole.OWNER },
        },
      },
      include: {
        members: true,
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    const user = await tx.user.findUnique({ where: { id: userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        canSell: true,
        platformRole:
          user?.platformRole === PlatformRole.BUYER
            ? PlatformRole.SELLER
            : user?.platformRole,
      },
    });

    return created;
  });

  try {
    const account = await ensureAccountForUser(userId);
    const linked = await prisma.tenant.findUnique({
      where: { shopId: shop.id },
    });
    if (!linked) {
      await createStoreTenant(account.id, {
        name: shop.name,
        shopId: shop.id,
      });
    }
  } catch (error) {
    console.error("[marketplace] auto STORE tenant failed", shop.id, error);
  }

  return shop;
}

export async function listPublicShops(query: {
  q?: string;
  type?: string;
  province?: string;
  page?: string;
  limit?: string;
}) {
  const page = Math.max(1, Number(query.page ?? 1));
  const limit = Math.min(48, Math.max(1, Number(query.limit ?? 12)));
  const shopType =
    query.type && Object.values(ShopType).includes(query.type as ShopType)
      ? (query.type as ShopType)
      : undefined;

  const where = {
    status: ShopStatus.ACTIVE,
    ...(shopType ? { shopType } : {}),
    ...(query.province ? { province: query.province } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" as const } },
            {
              description: {
                contains: query.q,
                mode: "insensitive" as const,
              },
            },
            { district: { contains: query.q, mode: "insensitive" as const } },
            { province: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const items = await prisma.shop.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true } },
      _count: { select: { products: true, followers: true } },
    },
    orderBy: [{ reputationScore: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * limit,
    take: limit,
  });
  const total = await prisma.shop.count({ where });
  return {
    items: items.map((shop) => ({
      ...shop,
      reputationScore: reputationFrom(
        shop.ratingAvg,
        shop.ratingCount,
        shop._count.followers,
      ),
    })),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export function myShops(userId: string) {
  return prisma.shop.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { userId, isActive: true } } },
      ],
    },
    include: {
      _count: { select: { products: true, orders: true, followers: true } },
      members: {
        where: { userId },
        select: { role: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getShopBySlug(slug: string) {
  const shop = await prisma.shop.findFirst({
    where: { slug, status: ShopStatus.ACTIVE },
    include: {
      owner: { select: { id: true, name: true } },
      _count: { select: { products: true, followers: true } },
    },
  });
  if (!shop) throw new HttpError(404, "Loja não encontrada");
  return {
    ...shop,
    reputationScore: reputationFrom(
      shop.ratingAvg,
      shop.ratingCount,
      shop._count.followers,
    ),
  };
}

async function assertMembership(
  shopId: string,
  userId: string,
  roles: ShopRole[] = [ShopRole.OWNER, ShopRole.MANAGER, ShopRole.STAFF],
) {
  const member = await prisma.shopMember.findUnique({
    where: { shopId_userId: { shopId, userId } },
  });
  if (!member?.isActive || !roles.includes(member.role)) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (shop?.ownerId === userId) {
      return { role: ShopRole.OWNER as ShopRole };
    }
    throw new HttpError(403, "Sem permissão nesta loja");
  }
  return member;
}

export async function updateShop(
  id: string,
  userId: string,
  data: Partial<{
    name: string;
    description: string;
    logoUrl: string;
    bannerUrl: string;
    policiesText: string;
    hoursJson: Prisma.InputJsonValue;
    shopType: ShopType;
    province: string;
    district: string;
    latitude: number;
    longitude: number;
    status: ShopStatus;
  }>,
) {
  await assertMembership(id, userId, [ShopRole.OWNER, ShopRole.MANAGER]);
  if (
    data.province ||
    data.district ||
    data.latitude != null ||
    data.longitude != null
  ) {
    const current = await prisma.shop.findUnique({ where: { id } });
    if (!current) throw new HttpError(404, "Loja não encontrada");
    assertGeo({
      province: data.province ?? current.province,
      district: data.district ?? current.district,
      latitude: data.latitude ?? current.latitude,
      longitude: data.longitude ?? current.longitude,
    });
  }

  return prisma.shop.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
      ...(data.bannerUrl !== undefined ? { bannerUrl: data.bannerUrl } : {}),
      ...(data.policiesText !== undefined
        ? { policiesText: data.policiesText }
        : {}),
      ...(data.hoursJson !== undefined ? { hoursJson: data.hoursJson } : {}),
      ...(data.shopType !== undefined ? { shopType: data.shopType } : {}),
      ...(data.province !== undefined ? { province: data.province } : {}),
      ...(data.district !== undefined ? { district: data.district } : {}),
      ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
      ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });
}

export async function followShop(userId: string, shopId: string) {
  await prisma.shopFollow.upsert({
    where: { userId_shopId: { shopId, userId } },
    create: { shopId, userId },
    update: {},
  });
  return { following: true };
}

export async function unfollowShop(userId: string, shopId: string) {
  await prisma.shopFollow.deleteMany({ where: { shopId, userId } });
  return { following: false };
}

export async function isFollowingShop(userId: string, shopId: string) {
  const row = await prisma.shopFollow.findUnique({
    where: { userId_shopId: { shopId, userId } },
  });
  return { following: Boolean(row) };
}

/* ── Ads ─────────────────────────────────────────────────────── */

export function listPublicAds(slot?: AdSlot) {
  const now = new Date();
  return prisma.ad.findMany({
    where: {
      status: AdStatus.ACTIVE,
      ...(slot ? { slot } : {}),
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: {
      shop: { select: { id: true, name: true, slug: true } },
    },
  });
}

export function listAdminAds() {
  return prisma.ad.findMany({
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: {
      shop: { select: { id: true, name: true, slug: true } },
    },
  });
}

export async function createAd(data: {
  title: string;
  subtitle?: string;
  imageUrl: string;
  linkUrl: string;
  slot?: AdSlot;
  status?: AdStatus;
  priority?: number;
  startsAt?: string;
  endsAt?: string;
  shopId?: string;
}) {
  if (!data.title?.trim() || !data.imageUrl?.trim() || !data.linkUrl?.trim()) {
    throw new HttpError(400, "Título, imagem e link são obrigatórios");
  }
  return prisma.ad.create({
    data: {
      title: data.title.trim(),
      subtitle: data.subtitle?.trim() || null,
      imageUrl: data.imageUrl.trim(),
      linkUrl: data.linkUrl.trim(),
      slot: data.slot ?? AdSlot.HOME_STRIP,
      status: data.status ?? AdStatus.DRAFT,
      priority: data.priority ?? 0,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
      shopId: data.shopId || null,
    },
  });
}

export async function updateAd(
  id: string,
  data: {
    title?: string;
    subtitle?: string | null;
    imageUrl?: string;
    linkUrl?: string;
    slot?: AdSlot;
    status?: AdStatus;
    priority?: number;
    startsAt?: string | null;
    endsAt?: string | null;
    shopId?: string | null;
  },
) {
  const existing = await prisma.ad.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Anúncio não encontrado");

  return prisma.ad.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.subtitle !== undefined
        ? { subtitle: data.subtitle?.trim() || null }
        : {}),
      ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl.trim() } : {}),
      ...(data.linkUrl !== undefined ? { linkUrl: data.linkUrl.trim() } : {}),
      ...(data.slot !== undefined ? { slot: data.slot } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.startsAt !== undefined
        ? { startsAt: data.startsAt ? new Date(data.startsAt) : null }
        : {}),
      ...(data.endsAt !== undefined
        ? { endsAt: data.endsAt ? new Date(data.endsAt) : null }
        : {}),
      ...(data.shopId !== undefined ? { shopId: data.shopId || null } : {}),
    },
  });
}

export async function removeAd(id: string) {
  const existing = await prisma.ad.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Anúncio não encontrado");
  await prisma.ad.delete({ where: { id } });
  return { ok: true };
}

/* ── Wishlist ────────────────────────────────────────────────── */

export function listWishlist(userId: string) {
  return prisma.wishlistItem.findMany({
    where: { userId },
    include: {
      product: {
        include: {
          images: { orderBy: { isPrimary: "desc" }, take: 1 },
          shop: { select: { id: true, name: true, slug: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function addWishlist(userId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, status: ProductStatus.ACTIVE },
  });
  if (!product) throw new HttpError(404, "Produto não encontrado");

  return prisma.wishlistItem.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId },
    update: {},
    include: { product: true },
  });
}

export async function removeWishlist(userId: string, productId: string) {
  await prisma.wishlistItem.deleteMany({ where: { userId, productId } });
  return { ok: true };
}
