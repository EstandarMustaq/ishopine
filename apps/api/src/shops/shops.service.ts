import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformRole, Prisma, ShopRole, ShopStatus, ShopType } from '@prisma/client';
import { AccountsService } from '../accounts/accounts.service';
import { PrismaService } from '../prisma/prisma.service';
import { isValidMzLocation } from '../common/mozambique';

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function reputationFrom(ratingAvg: number, ratingCount: number, followers = 0) {
  return Math.min(
    100,
    Math.round(ratingAvg * 18 + Math.min(ratingCount, 40) * 0.5 + Math.min(followers, 50) * 0.2),
  );
}

@Injectable()
export class ShopsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly accounts: AccountsService,
  ) {}

  private async organizationId() {
    const slug = this.config.get<string>('PLATFORM_ORG_SLUG', 'ishopine');
    const org = await this.prisma.organization.findUnique({ where: { slug } });
    if (!org) {
      throw new NotFoundException('Organização da plataforma não encontrada');
    }
    return org.id;
  }

  private assertGeo(data: {
    province?: string;
    district?: string;
    latitude?: number;
    longitude?: number;
  }) {
    if (
      !data.province ||
      !data.district ||
      typeof data.latitude !== 'number' ||
      typeof data.longitude !== 'number'
    ) {
      throw new BadRequestException(
        'Província, distrito e geolocalização são obrigatórios',
      );
    }
    if (!isValidMzLocation(data.province, data.district)) {
      throw new BadRequestException('Província ou distrito inválido em Moçambique');
    }
    if (
      data.latitude < -27.5 ||
      data.latitude > -10 ||
      data.longitude < 30 ||
      data.longitude > 41
    ) {
      throw new BadRequestException('Coordenadas fora de Moçambique');
    }
  }

  async createShop(
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
    this.assertGeo(data);
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

    try {
      const account = await this.accounts.ensureAccountForUser(userId);
      const linked = await this.prisma.tenant.findUnique({
        where: { shopId: shop.id },
      });
      if (!linked) {
        await this.accounts.createStoreTenant(account.id, {
          name: shop.name,
          shopId: shop.id,
        });
      }
    } catch (error) {
      console.error('[shops] auto STORE tenant failed', shop.id, error);
    }

    return shop;
  }

  listPublic(query: {
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
              { name: { contains: query.q, mode: 'insensitive' as const } },
              {
                description: {
                  contains: query.q,
                  mode: 'insensitive' as const,
                },
              },
              { district: { contains: query.q, mode: 'insensitive' as const } },
              { province: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    return this.prisma.shop
      .findMany({
        where,
        include: {
          owner: { select: { id: true, name: true } },
          _count: { select: { products: true, followers: true } },
        },
        orderBy: [{ reputationScore: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      })
      .then(async (items) => {
        const total = await this.prisma.shop.count({ where });
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
        _count: { select: { products: true, orders: true, followers: true } },
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
        _count: { select: { products: true, followers: true } },
      },
    });
    if (!shop) {
      throw new NotFoundException('Loja não encontrada');
    }
    return {
      ...shop,
      reputationScore: reputationFrom(
        shop.ratingAvg,
        shop.ratingCount,
        shop._count.followers,
      ),
    };
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
    await this.assertMembership(id, userId, [ShopRole.OWNER, ShopRole.MANAGER]);
    if (
      data.province ||
      data.district ||
      data.latitude != null ||
      data.longitude != null
    ) {
      const current = await this.prisma.shop.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Loja não encontrada');
      this.assertGeo({
        province: data.province ?? current.province,
        district: data.district ?? current.district,
        latitude: data.latitude ?? current.latitude,
        longitude: data.longitude ?? current.longitude,
      });
    }

    return this.prisma.shop.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
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

  async follow(userId: string, shopId: string) {
    await this.prisma.shopFollow.upsert({
      where: { userId_shopId: { shopId, userId } },
      create: { shopId, userId },
      update: {},
    });
    return { following: true };
  }

  async unfollow(userId: string, shopId: string) {
    await this.prisma.shopFollow.deleteMany({ where: { shopId, userId } });
    return { following: false };
  }

  async isFollowing(userId: string, shopId: string) {
    const row = await this.prisma.shopFollow.findUnique({
      where: { userId_shopId: { shopId, userId } },
    });
    return { following: Boolean(row) };
  }
}
