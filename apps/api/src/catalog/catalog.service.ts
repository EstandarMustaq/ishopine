import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductStatus, Role } from '@prisma/client';
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
    featured?: string;
    status?: ProductStatus;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
    page?: string;
    limit?: string;
    role?: Role;
  }) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(48, Math.max(1, Number(query.limit ?? 12)));
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    if (query.role !== Role.ADMIN && query.role !== Role.OPERATOR) {
      where.status = ProductStatus.ACTIVE;
    } else if (query.status) {
      where.status = query.status;
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
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
      },
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    return product;
  }

  async createProduct(data: {
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
    featured?: boolean;
    sku?: string;
    images?: Array<{ url: string; publicId?: string; alt?: string; isPrimary?: boolean }>;
  }) {
    const slug = slugify(data.name);
    const sku =
      data.sku ??
      `MV-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 999)
        .toString()
        .padStart(3, '0')}`;

    return this.prisma.product.create({
      data: {
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
        images: true,
      },
    });
  }

  async updateProduct(
    id: string,
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
      featured: boolean;
    }>,
  ) {
    await this.getProduct(id);

    return this.prisma.product.update({
      where: { id },
      data: {
        ...data,
        ...(data.name ? { slug: slugify(data.name) } : {}),
      },
      include: {
        category: true,
        images: true,
      },
    });
  }

  async addProductImage(
    productId: string,
    image: { url: string; publicId?: string; alt?: string; isPrimary?: boolean },
  ) {
    const product = await this.getProduct(productId);
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

  async deleteProduct(id: string) {
    const product = await this.getProduct(id);
    if (product.stock > 0) {
      throw new BadRequestException(
        'Arquive o produto ou zere o estoque antes de remover',
      );
    }
    return this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.ARCHIVED },
    });
  }
}
