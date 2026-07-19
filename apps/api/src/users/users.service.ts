import { Injectable, NotFoundException } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(platformRole?: PlatformRole) {
    return this.prisma.user.findMany({
      where: platformRole ? { platformRole } : undefined,
      select: {
        id: true,
        email: true,
        name: true,
        platformRole: true,
        phone: true,
        isActive: true,
        canBuy: true,
        canSell: true,
        totpEnabled: true,
        emailVerifiedAt: true,
        createdAt: true,
        _count: {
          select: {
            buyerOrders: true,
            ownedShops: true,
            shopMemberships: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRole(id: string, platformRole: PlatformRole) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return this.prisma.user.update({
      where: { id },
      data: {
        platformRole,
        canSell:
          platformRole === PlatformRole.SELLER ||
          platformRole === PlatformRole.PLATFORM_ADMIN ||
          platformRole === PlatformRole.PLATFORM_OPERATOR
            ? true
            : user.canSell,
      },
      select: {
        id: true,
        email: true,
        name: true,
        platformRole: true,
        isActive: true,
        canSell: true,
      },
    });
  }

  async setActive(id: string, isActive: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        email: true,
        name: true,
        platformRole: true,
        isActive: true,
      },
    });
  }

  listAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: { isDefault: 'desc' },
    });
  }

  async createAddress(
    userId: string,
    data: {
      label?: string;
      street: string;
      number: string;
      complement?: string;
      district: string;
      city: string;
      state: string;
      zipCode: string;
      isDefault?: boolean;
    },
  ) {
    if (data.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.create({
      data: {
        userId,
        label: data.label ?? 'Principal',
        street: data.street,
        number: data.number,
        complement: data.complement,
        district: data.district,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        isDefault: data.isDefault ?? false,
      },
    });
  }
}
