/**
 * Phase 7–8: wallet service owns read paths when WALLET_OWNED≠0.
 * Tenant wallet requires active membership (no IDOR via x-tenant-id).
 */
import http from "node:http";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME } from "@ishopine/shared";

const prisma = new PrismaClient();
const jwtSecret = process.env.JWT_SECRET || "";

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

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function pathOnly(url?: string) {
  return (url || "/").split("?")[0];
}

async function accountIdForUser(userId: string) {
  const account = await prisma.account.findUnique({ where: { userId } });
  return account?.id ?? null;
}

async function ensureAccountWallet(accountId: string) {
  const key = `account:${accountId}`;
  const existing = await prisma.wallet.findUnique({ where: { key } });
  if (existing) return existing;
  return prisma.wallet.create({
    data: {
      key,
      ownerType: "ACCOUNT",
      accountId,
      currency: "MZN",
    },
  });
}

async function ensureTenantWallet(tenantId: string) {
  const key = `tenant:${tenantId}`;
  const existing = await prisma.wallet.findUnique({ where: { key } });
  if (existing) return existing;
  return prisma.wallet.create({
    data: {
      key,
      ownerType: "TENANT",
      tenantId,
      currency: "MZN",
    },
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

export async function handleOwnedWallet(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const path = pathOnly(req.url);
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
    const take = Math.min(100, Math.max(1, Number(url.searchParams.get("take") || 50)));
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
