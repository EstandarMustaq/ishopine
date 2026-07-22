/**
 * Phase 7–10: wallet owns reads + internal settle when WALLET_OWNED≠0.
 * Settle: POST /api/wallet/internal/settle-order (Bearer INTERNAL_SERVICE_SECRET|CRON_SECRET).
 * Idempotent by ledger reference=orderId (CREDIT).
 */
import http from "node:http";
import {
  LedgerEntryType,
  Prisma,
  PrismaClient,
  WalletOwnerType,
} from "@prisma/client";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME } from "@ishopine/shared";

const prisma = new PrismaClient();
const jwtSecret = process.env.JWT_SECRET || "";
const internalSecret =
  process.env.INTERNAL_SERVICE_SECRET || process.env.CRON_SECRET || "";

type JwtPayload = { sub: string };

function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${name}=`)) continue;
    return decodeURIComponent(trimmed.slice(name.length + 1));
  }
  return null;
}

function extractToken(req: http.IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return parseCookie(req.headers.cookie, AUTH_COOKIE_NAME);
}

function verifyUser(req: http.IncomingMessage): JwtPayload | null {
  const token = extractToken(req);
  if (!token || !jwtSecret) return null;
  try {
    return jwt.verify(token, jwtSecret) as JwtPayload;
  } catch {
    return null;
  }
}

function verifyInternal(req: http.IncomingMessage): boolean {
  if (!internalSecret) return false;
  const auth = req.headers.authorization;
  if (!auth?.toLowerCase().startsWith("bearer ")) return false;
  const token = auth.slice(7).trim();
  return token === internalSecret;
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function pathOnly(url?: string) {
  return (url || "/").split("?")[0];
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function accountIdForUser(userId: string) {
  const account = await prisma.account.findUnique({ where: { userId } });
  return account?.id ?? null;
}

async function ensureWallet(input: {
  ownerType: WalletOwnerType;
  accountId?: string | null;
  tenantId?: string | null;
}) {
  let key: string;
  switch (input.ownerType) {
    case WalletOwnerType.PLATFORM:
      key = "platform";
      break;
    case WalletOwnerType.ACCOUNT:
      if (!input.accountId) throw new Error("accountId obrigatório");
      key = `account:${input.accountId}`;
      break;
    case WalletOwnerType.TENANT:
      if (!input.tenantId) throw new Error("tenantId obrigatório");
      key = `tenant:${input.tenantId}`;
      break;
    default: {
      const _e: never = input.ownerType;
      return _e;
    }
  }
  const existing = await prisma.wallet.findUnique({ where: { key } });
  if (existing) return existing;
  return prisma.wallet.create({
    data: {
      key,
      ownerType: input.ownerType,
      accountId: input.accountId ?? null,
      tenantId: input.tenantId ?? null,
      currency: "MZN",
    },
  });
}

async function ensureAccountWallet(accountId: string) {
  return ensureWallet({
    ownerType: WalletOwnerType.ACCOUNT,
    accountId,
  });
}

async function ensureTenantWallet(tenantId: string) {
  return ensureWallet({
    ownerType: WalletOwnerType.TENANT,
    tenantId,
  });
}

/** Mirror Nest AccountsService.resolveTenantAccess. */
async function assertTenantMembership(accountId: string, tenantId: string) {
  const membership = await prisma.tenantMembership.findUnique({
    where: {
      tenantId_accountId: { tenantId, accountId },
    },
    include: { tenant: true },
  });
  if (!membership?.isActive || !membership.tenant.isActive) {
    return null;
  }
  return membership;
}

async function postCredit(input: {
  walletId: string;
  amountCents: number;
  reference: string;
  note: string;
}) {
  if (input.amountCents <= 0) return null;
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({
      where: { id: input.walletId },
    });
    if (!wallet?.isActive) throw new Error("Carteira inválida");
    const available = wallet.availableCents + input.amountCents;
    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { availableCents: available },
    });
    const entry = await tx.walletLedgerEntry.create({
      data: {
        walletId: wallet.id,
        type: LedgerEntryType.CREDIT,
        amountCents: input.amountCents,
        balanceAfterCents: available,
        reference: input.reference,
        note: input.note,
      },
    });
    return { wallet: updated, entry };
  });
}

/**
 * Idempotent settle: if any CREDIT already references orderId, skip.
 */
export async function settleOrderPayout(input: {
  orderId: string;
  orderNumber: string;
  sellerShopId: string;
  sellerNetCents: number;
  platformFeeCents: number;
}) {
  const already = await prisma.walletLedgerEntry.findFirst({
    where: {
      reference: input.orderId,
      type: LedgerEntryType.CREDIT,
    },
  });
  if (already) {
    return { alreadySettled: true, results: [] as unknown[] };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { shopId: input.sellerShopId },
  });
  const platform = await ensureWallet({
    ownerType: WalletOwnerType.PLATFORM,
  });
  const results: unknown[] = [];

  if (input.platformFeeCents > 0) {
    results.push(
      await postCredit({
        walletId: platform.id,
        amountCents: input.platformFeeCents,
        reference: input.orderId,
        note: `Taxa plataforma · ${input.orderNumber}`,
      }),
    );
  }

  if (tenant && input.sellerNetCents > 0) {
    const sellerWallet = await ensureTenantWallet(tenant.id);
    results.push(
      await postCredit({
        walletId: sellerWallet.id,
        amountCents: input.sellerNetCents,
        reference: input.orderId,
        note: `Venda · ${input.orderNumber}`,
      }),
    );
  } else if (!tenant && input.sellerNetCents > 0) {
    const shop = await prisma.shop.findUnique({
      where: { id: input.sellerShopId },
      include: { owner: { include: { account: true } } },
    });
    const accountId = shop?.owner?.account?.id;
    if (accountId) {
      const w = await ensureAccountWallet(accountId);
      results.push(
        await postCredit({
          walletId: w.id,
          amountCents: input.sellerNetCents,
          reference: input.orderId,
          note: `Venda · ${input.orderNumber}`,
        }),
      );
    }
  }

  await prisma.outboxMessage.create({
    data: {
      aggregateType: "wallet",
      aggregateId: input.orderId,
      eventType: "wallet.credited",
      payload: {
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        sellerNetCents: input.sellerNetCents,
        platformFeeCents: input.platformFeeCents,
      } as Prisma.InputJsonValue,
    },
  });

  return { alreadySettled: false, results };
}

export async function handleOwnedWallet(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const path = pathOnly(req.url);

  if (
    req.method === "POST" &&
    path === "/api/wallet/internal/settle-order"
  ) {
    if (!verifyInternal(req)) {
      json(res, 401, { message: "Não autorizado (internal secret)" });
      return true;
    }
    try {
      const body = (await readJsonBody(req)) as {
        orderId?: string;
        orderNumber?: string;
        sellerShopId?: string;
        sellerNetCents?: number;
        platformFeeCents?: number;
      };
      if (
        !body.orderId ||
        !body.orderNumber ||
        !body.sellerShopId ||
        typeof body.sellerNetCents !== "number" ||
        typeof body.platformFeeCents !== "number"
      ) {
        json(res, 400, { message: "Payload settle incompleto" });
        return true;
      }
      const result = await settleOrderPayout({
        orderId: body.orderId,
        orderNumber: body.orderNumber,
        sellerShopId: body.sellerShopId,
        sellerNetCents: body.sellerNetCents,
        platformFeeCents: body.platformFeeCents,
      });
      json(res, 200, result);
    } catch (error) {
      json(res, 400, {
        message: error instanceof Error ? error.message : "Settle falhou",
      });
    }
    return true;
  }

  if (req.method !== "GET") return false;

  const user = verifyUser(req);
  if (!user) {
    if (
      path === "/api/wallet/me" ||
      path === "/api/wallet/tenant" ||
      path === "/api/wallet/ledger"
    ) {
      json(res, 401, { message: "Não autenticado" });
      return true;
    }
    return false;
  }

  if (path === "/api/wallet/me") {
    const accountId = await accountIdForUser(user.sub);
    if (!accountId) {
      json(res, 404, { message: "Conta não encontrada" });
      return true;
    }
    const wallet = await ensureAccountWallet(accountId);
    const ledger = await prisma.walletLedgerEntry.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    json(res, 200, { wallet, ledger });
    return true;
  }

  if (path === "/api/wallet/tenant") {
    const tenantHeader = req.headers["x-tenant-id"];
    const tenantId =
      typeof tenantHeader === "string" && tenantHeader ? tenantHeader : null;
    if (!tenantId) {
      json(res, 200, { wallet: null, ledger: [] });
      return true;
    }
    const accountId = await accountIdForUser(user.sub);
    if (!accountId) {
      json(res, 404, { message: "Conta não encontrada" });
      return true;
    }
    const membership = await assertTenantMembership(accountId, tenantId);
    if (!membership) {
      json(res, 403, { message: "Sem acesso a este tenant" });
      return true;
    }
    const wallet = await ensureTenantWallet(tenantId);
    const ledger = await prisma.walletLedgerEntry.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    json(res, 200, { wallet, ledger });
    return true;
  }

  if (path === "/api/wallet/ledger") {
    const accountId = await accountIdForUser(user.sub);
    if (!accountId) {
      json(res, 404, { message: "Conta não encontrada" });
      return true;
    }
    const url = new URL(req.url || "/", "http://local");
    const take = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("take") || 50)),
    );
    const wallet = await ensureAccountWallet(accountId);
    const ledger = await prisma.walletLedgerEntry.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take,
    });
    json(res, 200, ledger);
    return true;
  }

  return false;
}
