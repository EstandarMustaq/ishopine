import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformRole, ShopRole, ShopStatus } from '@prisma/client';
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
export class ShopsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async organizationId() {
    const slug = this.config.get<string>('PLATFORM_ORG_SLUG', 'nkateko');
    const org = await this.prisma.organization.findUnique({ where: { slug } });
    if (!org) {
      throw new NotFoundException('Organização da plataforma não encontrada');
    }
    return org.id;
  }

  async createShop(
    userId: string,
    data: {
      name: string;
      description?: string;
      city?: string;
      state?: string;
      logoUrl?: string;
      bannerUrl?: string;
    },
  ) {
    const organizationId = await this.organizationId();
    let slug = slugify(data.name);
    const clash = await this.prisma.shop.findUnique({
      where: {
        organizationId_slug: { organizationId, slug },
      },
    });
    if (clash) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const shop = await this.prisma.$transaction(async (tx) => {
      const created = await tx.shop.create({
        data: {
          organizationId,
          ownerId: userId,
          name: data.name,
          slug,
          description: data.description,
          city: data.city,
          state: data.state,
          logoUrl: data.logoUrl,
          bannerUrl: data.bannerUrl,
          status: ShopStatus.ACTIVE,
          members: {
            create: {
              userId,
              role: ShopRole.OWNER,
            },
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

    return shop;
  }

  listPublic(query: { q?: string; page?: string; limit?: string }) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(48, Math.max(1, Number(query.limit ?? 12)));

    return this.prisma.shop
      .findMany({
        where: {
          status: ShopStatus.ACTIVE,
          ...(query.q
            ? {
                OR: [
                  { name: { contains: query.q, mode: 'insensitive' as const } },
                  {
                    description: {
                      contains: query.q,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              }
            : {}),
        },
        include: {
          owner: { select: { id: true, name: true } },
          _count: { select: { products: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      })
      .then(async (items) => {
        const total = await this.prisma.shop.count({
          where: { status: ShopStatus.ACTIVE },
        });
        return {
          items,
          meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
          },
        };
      });
  }

  myShops(userId: string) {
    return this.prisma.shop.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId, isActive: true } } },
        ],
      },
      include: {
        _count: { select: { products: true, orders: true } },
        members: {
          where: { userId },
          select: { role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBySlug(slug: string) {
    const shop = await this.prisma.shop.findFirst({
      where: { slug, status: ShopStatus.ACTIVE },
      include: {
        owner: { select: { id: true, name: true } },
        _count: { select: { products: true } },
      },
    });
    if (!shop) {
      throw new NotFoundException('Loja não encontrada');
    }
    return shop;
  }

  async assertMembership(
    shopId: string,
    userId: string,
    roles: ShopRole[] = [ShopRole.OWNER, ShopRole.MANAGER, ShopRole.STAFF],
  ) {
    const member = await this.prisma.shopMember.findUnique({
      where: { shopId_userId: { shopId, userId } },
    });
    if (!member?.isActive || !roles.includes(member.role)) {
      const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
      if (shop?.ownerId === userId) {
        return { role: ShopRole.OWNER as ShopRole };
      }
      throw new ForbiddenException('Sem permissão nesta loja');
    }
    return member;
  }

  async updateShop(
    shopId: string,
    userId: string,
    data: Partial<{
      name: string;
      description: string;
      logoUrl: string;
      bannerUrl: string;
      city: string;
      state: string;
      status: ShopStatus;
    }>,
  ) {
    await this.assertMembership(shopId, userId, [
      ShopRole.OWNER,
      ShopRole.MANAGER,
    ]);

    if (data.name) {
      const organizationId = await this.organizationId();
      const slug = slugify(data.name);
      const clash = await this.prisma.shop.findFirst({
        where: {
          organizationId,
          slug,
          NOT: { id: shopId },
        },
      });
      if (clash) {
        throw new ConflictException('Já existe loja com este nome/slug');
      }
      return this.prisma.shop.update({
        where: { id: shopId },
        data: { ...data, slug },
      });
    }

    return this.prisma.shop.update({
      where: { id: shopId },
      data,
    });
  }
}
