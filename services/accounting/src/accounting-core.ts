/**
 * Phase 21: accounting core — chart of accounts, entries, post/void, summary.
 */
import {
  AccountingEntryStatus,
  AccountingEntryType,
  PlatformRole,
  PrismaClient,
} from "@prisma/client";
import { HttpError } from "./http-error";

export const prisma = new PrismaClient();

export { HttpError };

export function listAccounts() {
  return prisma.accountingAccount.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });
}

export async function createAccount(data: {
  code: string;
  name: string;
  type: AccountingEntryType;
  description?: string;
}) {
  return prisma.accountingAccount.create({ data });
}

async function nextEntryNumber() {
  const count = await prisma.accountingEntry.count();
  return `LC${String(count + 1).padStart(6, "0")}`;
}

export async function listEntries(query: {
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
    prisma.accountingEntry.findMany({
      where,
      include: {
        debitAccount: true,
        creditAccount: true,
        createdBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
        order: { select: { id: true, orderNumber: true } },
      },
      orderBy: { entryDate: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.accountingEntry.count({ where }),
  ]);

  return {
    items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

export async function createEntry(
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
    throw new HttpError(400, "Valor deve ser positivo");
  }
  if (data.debitAccountId === data.creditAccountId) {
    throw new HttpError(400, "Contas de débito e crédito devem diferir");
  }

  const [debit, credit] = await Promise.all([
    prisma.accountingAccount.findUnique({
      where: { id: data.debitAccountId },
    }),
    prisma.accountingAccount.findUnique({
      where: { id: data.creditAccountId },
    }),
  ]);

  if (!debit || !credit) {
    throw new HttpError(404, "Conta contábil não encontrada");
  }

  const status = data.postImmediately
    ? AccountingEntryStatus.POSTED
    : AccountingEntryStatus.DRAFT;

  return prisma.accountingEntry.create({
    data: {
      entryNumber: await nextEntryNumber(),
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

/**
 * Phase 26: order fulfill revenue — idempotent on orderId + REVENUE.
 * Resolves cash 1.1.01 / revenue 3.1.01 like Nest/orders inline.
 */
export async function recordOrderRevenue(input: {
  orderId: string;
  orderNumber: string;
  amountCents: number;
  operatorId: string;
}) {
  if (input.amountCents <= 0) {
    throw new HttpError(400, "Valor deve ser positivo");
  }
  const existing = await prisma.accountingEntry.findFirst({
    where: { orderId: input.orderId, type: AccountingEntryType.REVENUE },
  });
  if (existing) {
    return { entry: existing, alreadyPosted: true as const };
  }

  const cashAccount = await prisma.accountingAccount.findUnique({
    where: { code: "1.1.01" },
  });
  const revenueAccount = await prisma.accountingAccount.findUnique({
    where: { code: "3.1.01" },
  });
  if (!cashAccount || !revenueAccount) {
    throw new HttpError(
      400,
      "Contas 1.1.01 / 3.1.01 em falta — seed accounting",
    );
  }

  const entry = await createEntry(input.operatorId, {
    description: `Receita do pedido ${input.orderNumber}`,
    type: AccountingEntryType.REVENUE,
    amountCents: input.amountCents,
    debitAccountId: cashAccount.id,
    creditAccountId: revenueAccount.id,
    orderId: input.orderId,
    postImmediately: true,
  });

  return { entry, alreadyPosted: false as const };
}

export async function postEntry(id: string, reviewerId: string) {
  const entry = await prisma.accountingEntry.findUnique({
    where: { id },
  });
  if (!entry) {
    throw new HttpError(404, "Lançamento não encontrado");
  }
  if (entry.status !== AccountingEntryStatus.DRAFT) {
    throw new HttpError(400, "Apenas rascunhos podem ser lançados");
  }

  return prisma.accountingEntry.update({
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

export async function voidEntry(
  id: string,
  reviewerId: string,
  role: PlatformRole,
) {
  if (role !== PlatformRole.PLATFORM_ADMIN) {
    throw new HttpError(400, "Somente administradores podem estornar");
  }

  const entry = await prisma.accountingEntry.findUnique({
    where: { id },
  });
  if (!entry) {
    throw new HttpError(404, "Lançamento não encontrado");
  }
  if (entry.status === AccountingEntryStatus.VOID) {
    throw new HttpError(400, "Lançamento já estornado");
  }

  return prisma.accountingEntry.update({
    where: { id },
    data: {
      status: AccountingEntryStatus.VOID,
      reviewedById: reviewerId,
      voidedAt: new Date(),
    },
  });
}

export async function summary() {
  const posted = await prisma.accountingEntry.findMany({
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
