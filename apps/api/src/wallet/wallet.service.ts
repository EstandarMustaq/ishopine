import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LedgerEntryType,
  Prisma,
  WalletOwnerType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  private keyFor(
    ownerType: WalletOwnerType,
    accountId?: string | null,
    tenantId?: string | null,
  ) {
    switch (ownerType) {
      case WalletOwnerType.PLATFORM:
        return 'platform';
      case WalletOwnerType.ACCOUNT:
        if (!accountId) throw new BadRequestException('accountId obrigatório');
        return `account:${accountId}`;
      case WalletOwnerType.TENANT:
        if (!tenantId) throw new BadRequestException('tenantId obrigatório');
        return `tenant:${tenantId}`;
      default: {
        const _e: never = ownerType;
        return _e;
      }
    }
  }

  async ensureWallet(input: {
    ownerType: WalletOwnerType;
    accountId?: string | null;
    tenantId?: string | null;
    currency?: string;
  }) {
    const key = this.keyFor(input.ownerType, input.accountId, input.tenantId);
    const existing = await this.prisma.wallet.findUnique({ where: { key } });
    if (existing) return existing;
    return this.prisma.wallet.create({
      data: {
        key,
        ownerType: input.ownerType,
        accountId: input.accountId ?? null,
        tenantId: input.tenantId ?? null,
        currency: input.currency ?? 'MZN',
      },
    });
  }

  async getByKey(key: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { key },
      include: {
        ledger: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!wallet) throw new NotFoundException('Carteira não encontrada');
    return wallet;
  }

  async getMineForAccount(accountId: string) {
    return this.ensureWallet({
      ownerType: WalletOwnerType.ACCOUNT,
      accountId,
    });
  }

  async getMineForTenant(tenantId: string) {
    return this.ensureWallet({
      ownerType: WalletOwnerType.TENANT,
      tenantId,
    });
  }

  async listLedger(walletId: string, take = 50) {
    return this.prisma.walletLedgerEntry.findMany({
      where: { walletId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, Math.max(1, take)),
    });
  }

  /**
   * Atomic credit/debit. amountCents must be > 0.
   * CREDIT increases available; DEBIT decreases.
   */
  async postEntry(input: {
    walletId: string;
    type: LedgerEntryType;
    amountCents: number;
    reference?: string;
    note?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    if (input.amountCents <= 0) {
      throw new BadRequestException('amountCents deve ser positivo');
    }

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { id: input.walletId },
      });
      if (!wallet?.isActive) {
        throw new NotFoundException('Carteira inválida');
      }

      let available = wallet.availableCents;
      let held = wallet.heldCents;

      switch (input.type) {
        case LedgerEntryType.CREDIT:
          available += input.amountCents;
          break;
        case LedgerEntryType.DEBIT:
          if (available < input.amountCents) {
            throw new BadRequestException('Saldo insuficiente');
          }
          available -= input.amountCents;
          break;
        case LedgerEntryType.HOLD:
          if (available < input.amountCents) {
            throw new BadRequestException('Saldo insuficiente para hold');
          }
          available -= input.amountCents;
          held += input.amountCents;
          break;
        case LedgerEntryType.RELEASE:
          if (held < input.amountCents) {
            throw new BadRequestException('Hold insuficiente');
          }
          held -= input.amountCents;
          available += input.amountCents;
          break;
        case LedgerEntryType.ADJUSTMENT:
          available += input.amountCents; // signed via note; keep positive API
          break;
        default: {
          const _e: never = input.type;
          return _e;
        }
      }

      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { availableCents: available, heldCents: held },
      });

      const entry = await tx.walletLedgerEntry.create({
        data: {
          walletId: wallet.id,
          type: input.type,
          amountCents: input.amountCents,
          balanceAfterCents: available,
          reference: input.reference,
          note: input.note,
          metadata: input.metadata,
        },
      });

      return { wallet: updated, entry };
    });
  }

  /** Credit seller tenant + platform fee wallets after a paid order. */
  async settleOrderPayout(input: {
    orderId: string;
    orderNumber: string;
    sellerShopId: string;
    sellerNetCents: number;
    platformFeeCents: number;
  }) {
    const already = await this.prisma.walletLedgerEntry.findFirst({
      where: {
        reference: input.orderId,
        type: LedgerEntryType.CREDIT,
      },
    });
    if (already) {
      return { alreadySettled: true, results: [] as unknown[] };
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { shopId: input.sellerShopId },
    });

    const platform = await this.ensureWallet({
      ownerType: WalletOwnerType.PLATFORM,
    });

    const results: unknown[] = [];

    if (input.platformFeeCents > 0) {
      results.push(
        await this.postEntry({
          walletId: platform.id,
          type: LedgerEntryType.CREDIT,
          amountCents: input.platformFeeCents,
          reference: input.orderId,
          note: `Taxa plataforma · ${input.orderNumber}`,
        }),
      );
    }

    if (tenant && input.sellerNetCents > 0) {
      const sellerWallet = await this.ensureWallet({
        ownerType: WalletOwnerType.TENANT,
        tenantId: tenant.id,
      });
      results.push(
        await this.postEntry({
          walletId: sellerWallet.id,
          type: LedgerEntryType.CREDIT,
          amountCents: input.sellerNetCents,
          reference: input.orderId,
          note: `Venda · ${input.orderNumber}`,
        }),
      );
    } else if (!tenant && input.sellerNetCents > 0) {
      // Fallback: credit shop owner's account wallet
      const shop = await this.prisma.shop.findUnique({
        where: { id: input.sellerShopId },
        include: { owner: { include: { account: true } } },
      });
      const accountId = shop?.owner?.account?.id;
      if (accountId) {
        const w = await this.ensureWallet({
          ownerType: WalletOwnerType.ACCOUNT,
          accountId,
        });
        results.push(
          await this.postEntry({
            walletId: w.id,
            type: LedgerEntryType.CREDIT,
            amountCents: input.sellerNetCents,
            reference: input.orderId,
            note: `Venda · ${input.orderNumber}`,
          }),
        );
      }
    }

    return { alreadySettled: false, results };
  }
}
