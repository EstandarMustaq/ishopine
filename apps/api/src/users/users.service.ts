import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Nest users remnant (Phase 33). Admin list/role/active → platform-ops.
 * Address helpers kept for Nest fallthrough.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
