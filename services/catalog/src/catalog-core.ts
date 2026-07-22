/**
 * Phase 17: catalog domain core — parity with Nest CatalogService.
 */
import {
  CategoryScope,
  PlatformRole,
  Prisma,
  PrismaClient,
  ProductStatus,
  ShopRole,
  ShopStatus,
  TenantMemberRole,
  TenantType,
} from "@prisma/client";

export const prisma = new PrismaClient();
const orgSlug = process.env.PLATFORM_ORG_SLUG || "ishopine";
const isProd = process.env.NODE_ENV === "production";

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

export type DbUser = {
  id: string;
  platformRole: PlatformRole;
  totpEnabled: boolean;
  canSell: boolean;
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function loadUser(userId: string): Promise<DbUser | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      platformRole: true,
      totpEnabled: true,
      canSell: true,
    },
  });
}

/** Nest TwoFactorGuard parity for seller/admin catalog mutations. */
export async function assertCatalog2fa(user: DbUser, tfa?: boolean) {
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

  let isSellerMember = user.canSell;
  if (!isSellerMember) {
    const membership = await prisma.shopMember.findFirst({
      where: { userId: user.id, isActive: true },
      select: { id: true },
    });
    isSellerMember = Boolean(membership);
  }

  if (!elevated && !isSellerMember) return;

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

export function listCategories(query?: {
  shopId?: string;
  shop?: string;
  scope?: string;
}) {
  const scopeFilter = query?.scope?.toLowerCase();

  return prisma.category.findMany({
    where: {
      isActive: true,
      ...(scopeFilter === "store"
        ? {
            scope: CategoryScope.STORE,
            ...(query?.shopId
              ? { shopId: query.shopId }
              : query?.shop
                ? { shop: { slug: query.shop } }
                : {}),
          }
        : scopeFilter === "global"
          ? { scope: CategoryScope.GLOBAL }
          : query?.shopId || query?.shop
            ? {
                OR: [
                  { scope: CategoryScope.GLOBAL },
                  {
                    scope: CategoryScope.STORE,
                    ...(query.shopId
                      ? { shopId: query.shopId }
                      : { shop: { slug: query.shop } }),
                  },
                ],
              }
            : { scope: CategoryScope.GLOBAL }),
    },
    orderBy: [{ scope: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: {
      shop: { select: { id: true, name: true, slug: true } },
      _count: { select: { products: true } },
    },
  });
}

export async function createCategory(data: {
  name: string;
  description?: string;
  imageUrl?: string;
  parentId?: string;
  sortOrder?: number;
  scope?: CategoryScope;
  shopId?: string;
}) {
  const scope = data.scope ?? CategoryScope.GLOBAL;
  if (scope === CategoryScope.STORE && !data.shopId) {
    throw new HttpError(400, "Categorias STORE exigem shopId");
  }
  if (scope === CategoryScope.GLOBAL && data.shopId) {
    throw new HttpError(400, "Categorias GLOBAL não podem ter shopId");
  }

  const slug = slugify(data.name);
  if (scope === CategoryScope.GLOBAL) {
    const clash = await prisma.category.findFirst({
      where: { scope: CategoryScope.GLOBAL, slug },
    });
    if (clash) {
      throw new HttpError(400, "Já existe uma categoria global com este nome");
    }
  }

  if (data.parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: data.parentId },
    });
    if (!parent) throw new HttpError(404, "Categoria pai não encontrada");
    if (parent.scope !== scope) {
      throw new HttpError(400, "Pai deve ter o mesmo scope");
    }
    if (scope === CategoryScope.STORE && parent.shopId !== data.shopId) {
      throw new HttpError(400, "Pai deve pertencer à mesma loja");
    }
  }

  return prisma.category.create({
    data: {
      name: data.name,
      slug,
      description: data.description,
      imageUrl: data.imageUrl,
      parentId: data.parentId,
      sortOrder: data.sortOrder ?? 0,
      scope,
      shopId: scope === CategoryScope.STORE ? data.shopId : null,
    },
  });
}

async function assertCanManageShop(shopId: string, userId: string) {
  const member = await prisma.shopMember.findUnique({
    where: { shopId_userId: { shopId, userId } },
  });
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) throw new HttpError(404, "Loja não encontrada");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (
    user?.platformRole === PlatformRole.PLATFORM_ADMIN ||
    user?.platformRole === PlatformRole.PLATFORM_OPERATOR
  ) {
    return shop;
  }

  if (
    shop.ownerId === userId ||
    (member?.isActive &&
      [ShopRole.OWNER, ShopRole.MANAGER, ShopRole.STAFF].includes(member.role))
  ) {
    return shop;
  }

  throw new HttpError(403, "Sem permissão para gerenciar produtos desta loja");
}

export async function resolveTenantShopId(
  userId: string,
  tenant: TenantCtx | null | undefined,
  explicitShopId?: string,
): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const isStaff =
    user?.platformRole === PlatformRole.PLATFORM_ADMIN ||
    user?.platformRole === PlatformRole.PLATFORM_OPERATOR;

  if (tenant?.tenantType === TenantType.STORE) {
    if (!tenant.shopId) {
      throw new HttpError(
        400,
        "Tenant STORE sem loja ligada — associe um shop ao tenant",
      );
    }
    if (explicitShopId && explicitShopId !== tenant.shopId && !isStaff) {
      throw new HttpError(403, "shopId não corresponde ao tenant activo");
    }
    await assertCanManageShop(tenant.shopId, userId);
    return tenant.shopId;
  }

  if (explicitShopId) {
    await assertCanManageShop(explicitShopId, userId);
    return explicitShopId;
  }

  const owned = await prisma.shop.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: "asc" },
  });
  if (!owned) {
    throw new HttpError(
      400,
      "Crie uma loja antes de gerir produtos neste tenant",
    );
  }
  return owned.id;
}

export async function createStoreCategory(
  userId: string,
  tenant: TenantCtx,
  data: {
    name: string;
    description?: string;
    imageUrl?: string;
    parentId?: string;
    sortOrder?: number;
  },
) {
  const shopId = await resolveTenantShopId(userId, tenant);
  return createCategory({
    ...data,
    scope: CategoryScope.STORE,
    shopId,
  });
}

export async function listProducts(query: {
  q?: string;
  category?: string;
  shop?: string;
  shopId?: string;
  featured?: string;
  status?: ProductStatus;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  page?: string;
  limit?: string;
  platformRole?: PlatformRole;
}) {
  const page = Math.max(1, Number(query.page ?? 1));
  const limit = Math.min(48, Math.max(1, Number(query.limit ?? 12)));
  const skip = (page - 1) * limit;

  const isStaff =
    query.platformRole === PlatformRole.PLATFORM_ADMIN ||
    query.platformRole === PlatformRole.PLATFORM_OPERATOR;

  const where: Prisma.ProductWhereInput = {};

  if (!isStaff) {
    where.status = ProductStatus.ACTIVE;
  } else if (query.status) {
    where.status = query.status;
  }

  if (query.shopId) {
    where.shopId = query.shopId;
    if (!isStaff) {
      where.shop = { status: ShopStatus.ACTIVE };
    }
  } else if (query.shop) {
    where.shop = {
      slug: query.shop,
      ...(!isStaff ? { status: ShopStatus.ACTIVE } : {}),
    };
  } else if (!isStaff) {
    where.shop = { status: ShopStatus.ACTIVE };
  }

  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: "insensitive" } },
      { description: { contains: query.q, mode: "insensitive" } },
      { sku: { contains: query.q, mode: "insensitive" } },
    ];
  }

  if (query.category) {
    where.category = { slug: query.category };
  }

  if (query.featured === "true") {
    where.featured = true;
  }

  if (query.minPrice || query.maxPrice) {
    where.priceCents = {};
    if (query.minPrice) where.priceCents.gte = Number(query.minPrice);
    if (query.maxPrice) where.priceCents.lte = Number(query.maxPrice);
  }

  let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: "desc" };
  switch (query.sort) {
    case "price_asc":
      orderBy = { priceCents: "asc" };
      break;
    case "price_desc":
      orderBy = { priceCents: "desc" };
      break;
    case "name":
      orderBy = { name: "asc" };
      break;
    default:
      orderBy = { createdAt: "desc" };
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: true,
        shop: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            province: true,
            district: true,
            shopType: true,
            ratingAvg: true,
            ratingCount: true,
            reputationScore: true,
          },
        },
        images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function listSellerProducts(
  userId: string,
  tenant: TenantCtx,
  query: { q?: string; status?: ProductStatus; page?: string; limit?: string },
) {
  const shopId = await resolveTenantShopId(userId, tenant);
  return listProducts({
    ...query,
    shopId,
    platformRole: PlatformRole.PLATFORM_ADMIN,
    status: query.status,
  });
}

export async function getProduct(slugOrId: string) {
  const product = await prisma.product.findFirst({
    where: { OR: [{ slug: slugOrId }, { id: slugOrId }] },
    include: {
      category: true,
      shop: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          province: true,
          district: true,
          shopType: true,
          ratingAvg: true,
          ratingCount: true,
          reputationScore: true,
          logoUrl: true,
        },
      },
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
    },
  });
  if (!product) throw new HttpError(404, "Produto não encontrado");
  return product;
}

async function assertCategoryForShop(categoryId: string | undefined, shopId: string) {
  if (!categoryId) return;
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category || !category.isActive) {
    throw new HttpError(404, "Categoria não encontrada");
  }
  if (category.scope === CategoryScope.STORE && category.shopId !== shopId) {
    throw new HttpError(400, "Categoria de loja não pertence a este shop");
  }
}

export async function createProduct(
  userId: string,
  data: {
    shopId?: string;
    name: string;
    description: string;
    shortDescription?: string;
    priceCents: number;
    compareAtCents?: number;
    costCents?: number;
    stock?: number;
    status?: ProductStatus;
    categoryId?: string;
    brand?: string;
    material?: string;
    dimensions?: string;
    weightKg?: number;
    color?: string;
    condition?: string;
    featured?: boolean;
    sku?: string;
    images?: Array<{
      url: string;
      publicId?: string;
      alt?: string;
      isPrimary?: boolean;
    }>;
  },
  tenant?: TenantCtx | null,
) {
  const shopId = await resolveTenantShopId(userId, tenant, data.shopId);
  await assertCategoryForShop(data.categoryId, shopId);

  const baseSlug = slugify(data.name);
  let slug = baseSlug;
  const existingSlug = await prisma.product.findUnique({
    where: { shopId_slug: { shopId, slug } },
  });
  if (existingSlug) {
    slug = `${baseSlug}-${Date.now().toString(36)}`;
  }

  const sku =
    data.sku ??
    `NK-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 999)
      .toString()
      .padStart(3, "0")}`;

  return prisma.product.create({
    data: {
      shopId,
      name: data.name,
      slug,
      sku,
      description: data.description,
      shortDescription: data.shortDescription,
      priceCents: data.priceCents,
      compareAtCents: data.compareAtCents,
      costCents: data.costCents ?? 0,
      stock: data.stock ?? 0,
      status: data.status ?? ProductStatus.DRAFT,
      categoryId: data.categoryId,
      brand: data.brand,
      material: data.material,
      dimensions: data.dimensions,
      weightKg: data.weightKg,
      color: data.color,
      condition: data.condition ?? "new",
      featured: data.featured ?? false,
      images: data.images?.length
        ? {
            create: data.images.map((image, index) => ({
              url: image.url,
              publicId: image.publicId,
              alt: image.alt ?? data.name,
              isPrimary: image.isPrimary ?? index === 0,
              sortOrder: index,
            })),
          }
        : undefined,
    },
    include: {
      category: true,
      shop: { select: { id: true, name: true, slug: true } },
      images: true,
    },
  });
}

export async function updateProduct(
  id: string,
  userId: string,
  data: Partial<{
    name: string;
    description: string;
    shortDescription: string;
    priceCents: number;
    compareAtCents: number | null;
    costCents: number;
    stock: number;
    status: ProductStatus;
    categoryId: string | null;
    brand: string;
    material: string;
    dimensions: string;
    weightKg: number;
    color: string;
    condition: string;
    featured: boolean;
  }>,
  tenant?: TenantCtx | null,
) {
  const product = await getProduct(id);
  const shopId = await resolveTenantShopId(userId, tenant, product.shopId);
  if (product.shopId !== shopId) {
    throw new HttpError(403, "Produto fora do tenant activo");
  }
  if (data.categoryId) {
    await assertCategoryForShop(data.categoryId, shopId);
  }

  return prisma.product.update({
    where: { id: product.id },
    data: {
      ...data,
      ...(data.name ? { slug: slugify(data.name) } : {}),
    },
    include: {
      category: true,
      shop: { select: { id: true, name: true, slug: true } },
      images: true,
    },
  });
}

export async function addProductImage(
  productId: string,
  userId: string,
  image: {
    url: string;
    publicId?: string;
    alt?: string;
    isPrimary?: boolean;
  },
  tenant?: TenantCtx | null,
) {
  const product = await getProduct(productId);
  const shopId = await resolveTenantShopId(userId, tenant, product.shopId);
  if (product.shopId !== shopId) {
    throw new HttpError(403, "Produto fora do tenant activo");
  }

  if (image.isPrimary) {
    await prisma.productImage.updateMany({
      where: { productId: product.id },
      data: { isPrimary: false },
    });
  }

  return prisma.productImage.create({
    data: {
      productId: product.id,
      url: image.url,
      publicId: image.publicId,
      alt: image.alt ?? product.name,
      isPrimary: image.isPrimary ?? false,
    },
  });
}

export async function deleteProduct(
  id: string,
  userId: string,
  tenant?: TenantCtx | null,
) {
  const product = await getProduct(id);
  const shopId = await resolveTenantShopId(userId, tenant, product.shopId);
  if (product.shopId !== shopId) {
    throw new HttpError(403, "Produto fora do tenant activo");
  }
  if (product.stock > 0) {
    throw new HttpError(
      400,
      "Arquive o produto ou zere o estoque antes de remover",
    );
  }
  return prisma.product.update({
    where: { id: product.id },
    data: { status: ProductStatus.ARCHIVED },
  });
}
