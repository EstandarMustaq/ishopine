import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PlatformRole,
  Prisma,
  ProductStatus,
  ShopRole,
  ShopStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listCategories() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { products: true } },
      },
    });
  }

  async createCategory(data: {
    name: string;
    description?: string;
    imageUrl?: string;
    parentId?: string;
    sortOrder?: number;
  }) {
    const slug = slugify(data.name);
    return this.prisma.category.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        imageUrl: data.imageUrl,
        parentId: data.parentId,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async listProducts(query: {
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
        { name: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
        { sku: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    if (query.category) {
      where.category = { slug: query.category };
    }

    if (query.featured === 'true') {
      where.featured = true;
    }

    if (query.minPrice || query.maxPrice) {
      where.priceCents = {};
      if (query.minPrice) {
        where.priceCents.gte = Number(query.minPrice);
      }
      if (query.maxPrice) {
        where.priceCents.lte = Number(query.maxPrice);
      }
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
    switch (query.sort) {
      case 'price_asc':
        orderBy = { priceCents: 'asc' };
        break;
      case 'price_desc':
        orderBy = { priceCents: 'desc' };
        break;
      case 'name':
        orderBy = { name: 'asc' };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
          shop: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              city: true,
              state: true,
            },
          },
          images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
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

  async getProduct(slugOrId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [{ slug: slugOrId }, { id: slugOrId }],
      },
      include: {
        category: true,
        shop: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            city: true,
            state: true,
            logoUrl: true,
          },
        },
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
      },
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    return product;
  }

  private async assertCanManageShop(shopId: string, userId: string) {
    const member = await this.prisma.shopMember.findUnique({
      where: { shopId_userId: { shopId, userId } },
    });
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      throw new NotFoundException('Loja não encontrada');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (
      user?.platformRole === PlatformRole.PLATFORM_ADMIN ||
      user?.platformRole === PlatformRole.PLATFORM_OPERATOR
    ) {
      return shop;
    }

    if (
      shop.ownerId === userId ||
      (member?.isActive &&
        [ShopRole.OWNER, ShopRole.MANAGER, ShopRole.STAFF].includes(
          member.role,
        ))
    ) {
      return shop;
    }

    throw new ForbiddenException('Sem permissão para gerenciar produtos desta loja');
  }

  async createProduct(
    userId: string,
    data: {
      shopId: string;
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
  ) {
    await this.assertCanManageShop(data.shopId, userId);

    const baseSlug = slugify(data.name);
    let slug = baseSlug;
    const existingSlug = await this.prisma.product.findUnique({
      where: {
        shopId_slug: { shopId: data.shopId, slug },
      },
    });
    if (existingSlug) {
      slug = `${baseSlug}-${Date.now().toString(36)}`;
    }

    const sku =
      data.sku ??
      `NK-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 999)
        .toString()
        .padStart(3, '0')}`;

    return this.prisma.product.create({
      data: {
        shopId: data.shopId,
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
        condition: data.condition ?? 'new',
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

  async updateProduct(
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
  ) {
    const product = await this.getProduct(id);
    await this.assertCanManageShop(product.shopId, userId);

    return this.prisma.product.update({
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

  async addProductImage(
    productId: string,
    userId: string,
    image: {
      url: string;
      publicId?: string;
      alt?: string;
      isPrimary?: boolean;
    },
  ) {
    const product = await this.getProduct(productId);
    await this.assertCanManageShop(product.shopId, userId);

    if (image.isPrimary) {
      await this.prisma.productImage.updateMany({
        where: { productId: product.id },
        data: { isPrimary: false },
      });
    }

    return this.prisma.productImage.create({
      data: {
        productId: product.id,
        url: image.url,
        publicId: image.publicId,
        alt: image.alt ?? product.name,
        isPrimary: image.isPrimary ?? false,
      },
    });
  }

  async deleteProduct(id: string, userId: string) {
    const product = await this.getProduct(id);
    await this.assertCanManageShop(product.shopId, userId);

    if (product.stock > 0) {
      throw new BadRequestException(
        'Arquive o produto ou zere o estoque antes de remover',
      );
    }
    return this.prisma.product.update({
      where: { id: product.id },
      data: { status: ProductStatus.ARCHIVED },
    });
  }
}
