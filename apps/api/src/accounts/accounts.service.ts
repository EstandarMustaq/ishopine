import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantMemberRole, TenantType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureAccountForUser(userId: string) {
    const existing = await this.prisma.account.findUnique({
      where: { userId },
      include: {
        memberships: {
          where: { isActive: true },
          include: { tenant: true },
        },
        platformStaff: true,
      },
    });
    if (existing) return existing;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilizador não encontrado');

    return this.prisma.account.create({
      data: {
        userId: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
      },
      include: {
        memberships: {
          where: { isActive: true },
          include: { tenant: true },
        },
        platformStaff: true,
      },
    });
  }

  async listTenants(accountId: string) {
    const memberships = await this.prisma.tenantMembership.findMany({
      where: { accountId, isActive: true, tenant: { isActive: true } },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({
      membershipId: m.id,
      role: m.role,
      tenant: m.tenant,
    }));
  }

  async createParticularTenant(accountId: string, name?: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException('Conta não encontrada');

    const existing = await this.prisma.tenant.findUnique({
      where: { particularAccountId: accountId },
    });
    if (existing) {
      throw new BadRequestException(
        'Esta conta já tem um tenant PARTICULAR',
      );
    }

    const slugBase = this.slugify(name || account.name || 'particular');
    const slug = await this.uniqueTenantSlug(`p-${slugBase}`);

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          type: TenantType.PARTICULAR,
          name: name?.trim() || `${account.name} (Particular)`,
          slug,
          ownerAccountId: accountId,
          particularAccountId: accountId,
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

  async createStoreTenant(accountId: string, input: {
    name: string;
    shopId?: string;
  }) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException('Conta não encontrada');

    if (input.shopId) {
      const shop = await this.prisma.shop.findUnique({
        where: { id: input.shopId },
      });
      if (!shop) throw new NotFoundException('Loja não encontrada');
      if (shop.ownerId !== account.userId) {
        throw new ForbiddenException('Loja não pertence a esta conta');
      }
      const linked = await this.prisma.tenant.findUnique({
        where: { shopId: input.shopId },
      });
      if (linked) {
        throw new BadRequestException('Esta loja já tem tenant STORE');
      }
    }

    const slug = await this.uniqueTenantSlug(
      `s-${this.slugify(input.name)}`,
    );

    return this.prisma.$transaction(async (tx) => {
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

  /**
   * Resolve and authorize active tenant for an account.
   * PARTICULAR and STORE contexts never mix in the same request.
   */
  async resolveTenantAccess(accountId: string, tenantId: string) {
    const membership = await this.prisma.tenantMembership.findUnique({
      where: {
        tenantId_accountId: { tenantId, accountId },
      },
      include: { tenant: true },
    });

    if (!membership?.isActive || !membership.tenant.isActive) {
      throw new ForbiddenException('Sem acesso a este tenant');
    }

    return {
      tenantId: membership.tenant.id,
      tenantType: membership.tenant.type,
      tenantSlug: membership.tenant.slug,
      membershipRole: membership.role,
      shopId: membership.tenant.shopId,
    };
  }

  private slugify(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'tenant';
  }

  private async uniqueTenantSlug(base: string) {
    let slug = base;
    let i = 0;
    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      i += 1;
      slug = `${base}-${i}`;
    }
    return slug;
  }
}
