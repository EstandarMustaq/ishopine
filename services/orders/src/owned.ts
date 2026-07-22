/**
 * Phase 8: orders service owns GET reads when ORDERS_OWNED≠0.
 * Mutations (checkout, status) stay on Nest upstream.
 */
import http from "node:http";
import { PrismaClient, PlatformRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME } from "@ishopine/shared";

const prisma = new PrismaClient();
const jwtSecret = process.env.JWT_SECRET || "";

type JwtPayload = { sub: string; platformRole?: PlatformRole };

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

async function loadUserRole(userId: string): Promise<PlatformRole> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { platformRole: true },
  });
  return user?.platformRole ?? PlatformRole.BUYER;
}

async function resolveTenantShopId(userId: string, tenantId: string | null) {
  if (!tenantId) return null;
  const account = await prisma.account.findUnique({ where: { userId } });
  if (!account) return null;
  const membership = await prisma.tenantMembership.findUnique({
    where: {
      tenantId_accountId: { tenantId, accountId: account.id },
    },
    include: { tenant: true },
  });
  if (!membership?.isActive || !membership.tenant.isActive) return null;
  return membership.tenant.shopId;
}

export async function handleOwnedOrders(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  if (req.method !== "GET") return false;
  const path = pathOnly(req.url);

  const isMine = path === "/api/orders/mine";
  const isSelling = path === "/api/orders/selling";
  const orderMatch = path.match(/^\/api\/orders\/([^/]+)$/);
  const orderId =
    orderMatch &&
    orderMatch[1] !== "mine" &&
    orderMatch[1] !== "selling" &&
    orderMatch[1] !== "checkout"
      ? orderMatch[1]
      : null;

  if (!isMine && !isSelling && !orderId) return false;

  const jwtUser = verifyUser(req);
  if (!jwtUser) {
    json(res, 401, { message: "Não autenticado" });
    return true;
  }

  if (isMine) {
    const orders = await prisma.order.findMany({
      where: { buyerId: jwtUser.sub },
      include: {
        items: true,
        payments: true,
        address: true,
        sellerShop: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    json(res, 200, orders);
    return true;
  }

  if (isSelling) {
    const tenantHeader = req.headers["x-tenant-id"];
    const tenantId =
      typeof tenantHeader === "string" && tenantHeader ? tenantHeader : null;
    const tenantShopId = await resolveTenantShopId(jwtUser.sub, tenantId);
    const orders = await prisma.order.findMany({
      where: {
        sellerShop: {
          ...(tenantShopId
            ? { id: tenantShopId }
            : {
                OR: [
                  { ownerId: jwtUser.sub },
                  {
                    members: {
                      some: { userId: jwtUser.sub, isActive: true },
                    },
                  },
                ],
              }),
        },
      },
      include: {
        items: true,
        payments: true,
        buyer: { select: { id: true, name: true, email: true } },
        sellerShop: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    json(res, 200, orders);
    return true;
  }

  if (orderId) {
    const platformRole =
      jwtUser.platformRole ?? (await loadUserRole(jwtUser.sub));
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: {
          select: { id: true, name: true, email: true, phone: true },
        },
        sellerShop: {
          select: {
            id: true,
            name: true,
            slug: true,
            ownerId: true,
            members: {
              where: { userId: jwtUser.sub, isActive: true },
              select: { role: true },
            },
          },
        },
        items: { include: { product: { include: { images: true } } } },
        payments: true,
        address: true,
        accountingEntries: true,
      },
    });
    if (!order) {
      json(res, 404, { message: "Pedido não encontrado" });
      return true;
    }
    const isPlatform =
      platformRole === PlatformRole.PLATFORM_ADMIN ||
      platformRole === PlatformRole.PLATFORM_OPERATOR;
    const isBuyer = order.buyerId === jwtUser.sub;
    const isSeller =
      order.sellerShop.ownerId === jwtUser.sub ||
      order.sellerShop.members.length > 0;
    if (!isPlatform && !isBuyer && !isSeller) {
      json(res, 403, { message: "Sem acesso a este pedido" });
      return true;
    }
    json(res, 200, order);
    return true;
  }

  return false;
}
