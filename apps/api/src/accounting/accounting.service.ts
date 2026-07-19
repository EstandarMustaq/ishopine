import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountingEntryStatus,
  AccountingEntryType,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  listAccounts() {
    return this.prisma.accountingAccount.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
  }

  async createAccount(data: {
    code: string;
    name: string;
    type: AccountingEntryType;
    description?: string;
  }) {
    return this.prisma.accountingAccount.create({ data });
  }

  private async nextEntryNumber() {
    const count = await this.prisma.accountingEntry.count();
    return `LC${String(count + 1).padStart(6, '0')}`;
  }

  async listEntries(query: {
    status?: AccountingEntryStatus;
    type?: AccountingEntryType;
    from?: string;
    to?: string;
    page?: string;
    limit?: string;
  }) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));

    const where: {
      status?: AccountingEntryStatus;
      type?: AccountingEntryType;
      entryDate?: { gte?: Date; lte?: Date };
    } = {};

    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.from || query.to) {
      where.entryDate = {};
      if (query.from) where.entryDate.gte = new Date(query.from);
      if (query.to) where.entryDate.lte = new Date(query.to);
    }

    const [items, total] = await Promise.all([
      this.prisma.accountingEntry.findMany({
        where,
        include: {
          debitAccount: true,
          creditAccount: true,
          createdBy: { select: { id: true, name: true } },
          reviewedBy: { select: { id: true, name: true } },
          order: { select: { id: true, orderNumber: true } },
        },
        orderBy: { entryDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.accountingEntry.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async createEntry(
    userId: string,
    data: {
      description: string;
      type: AccountingEntryType;
      amountCents: number;
      debitAccountId: string;
      creditAccountId: string;
      orderId?: string;
      notes?: string;
      entryDate?: string;
      postImmediately?: boolean;
    },
  ) {
    if (data.amountCents <= 0) {
      throw new BadRequestException('Valor deve ser positivo');
    }
    if (data.debitAccountId === data.creditAccountId) {
      throw new BadRequestException('Contas de débito e crédito devem diferir');
    }

    const [debit, credit] = await Promise.all([
      this.prisma.accountingAccount.findUnique({
        where: { id: data.debitAccountId },
      }),
      this.prisma.accountingAccount.findUnique({
        where: { id: data.creditAccountId },
      }),
    ]);

    if (!debit || !credit) {
      throw new NotFoundException('Conta contábil não encontrada');
    }

    const status = data.postImmediately
      ? AccountingEntryStatus.POSTED
      : AccountingEntryStatus.DRAFT;

    return this.prisma.accountingEntry.create({
      data: {
        entryNumber: await this.nextEntryNumber(),
        description: data.description,
        type: data.type,
        status,
        amountCents: data.amountCents,
        debitAccountId: data.debitAccountId,
        creditAccountId: data.creditAccountId,
        orderId: data.orderId,
        notes: data.notes,
        entryDate: data.entryDate ? new Date(data.entryDate) : new Date(),
        createdById: userId,
        reviewedById: data.postImmediately ? userId : undefined,
        postedAt: data.postImmediately ? new Date() : undefined,
      },
      include: {
        debitAccount: true,
        creditAccount: true,
        createdBy: { select: { id: true, name: true } },
      },
    });
  }

  async postEntry(id: string, reviewerId: string) {
    const entry = await this.prisma.accountingEntry.findUnique({
      where: { id },
    });
    if (!entry) {
      throw new NotFoundException('Lançamento não encontrado');
    }
    if (entry.status !== AccountingEntryStatus.DRAFT) {
      throw new BadRequestException('Apenas rascunhos podem ser lançados');
    }

    return this.prisma.accountingEntry.update({
      where: { id },
      data: {
        status: AccountingEntryStatus.POSTED,
        reviewedById: reviewerId,
        postedAt: new Date(),
      },
      include: {
        debitAccount: true,
        creditAccount: true,
      },
    });
  }

  async voidEntry(id: string, reviewerId: string, role: Role) {
    if (role !== Role.ADMIN) {
      throw new BadRequestException('Somente administradores podem estornar');
    }

    const entry = await this.prisma.accountingEntry.findUnique({
      where: { id },
    });
    if (!entry) {
      throw new NotFoundException('Lançamento não encontrado');
    }
    if (entry.status === AccountingEntryStatus.VOID) {
      throw new BadRequestException('Lançamento já estornado');
    }

    return this.prisma.accountingEntry.update({
      where: { id },
      data: {
        status: AccountingEntryStatus.VOID,
        reviewedById: reviewerId,
        voidedAt: new Date(),
      },
    });
  }

  async summary() {
    const posted = await this.prisma.accountingEntry.findMany({
      where: { status: AccountingEntryStatus.POSTED },
      select: { type: true, amountCents: true },
    });

    const totals = {
      revenueCents: 0,
      expenseCents: 0,
      assetCents: 0,
      liabilityCents: 0,
      equityCents: 0,
      transferCents: 0,
    };

    for (const entry of posted) {
      switch (entry.type) {
        case AccountingEntryType.REVENUE:
          totals.revenueCents += entry.amountCents;
          break;
        case AccountingEntryType.EXPENSE:
          totals.expenseCents += entry.amountCents;
          break;
        case AccountingEntryType.ASSET:
          totals.assetCents += entry.amountCents;
          break;
        case AccountingEntryType.LIABILITY:
          totals.liabilityCents += entry.amountCents;
          break;
        case AccountingEntryType.EQUITY:
          totals.equityCents += entry.amountCents;
          break;
        case AccountingEntryType.TRANSFER:
          totals.transferCents += entry.amountCents;
          break;
        default: {
          const _exhaustive: never = entry.type;
          void _exhaustive;
        }
      }
    }

    return {
      ...totals,
      netIncomeCents: totals.revenueCents - totals.expenseCents,
      entryCount: posted.length,
    };
  }
}
