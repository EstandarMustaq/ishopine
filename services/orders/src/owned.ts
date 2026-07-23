/**
 * Phase 8–10: orders strangler owns cart, order reads, status, and checkout.
 * PaySuite / commerce saga stay Nest + orchestrator.
 */
import http from "node:http";
import {
  AccountingEntryStatus,
  AccountingEntryType,
  CarrierCode,
  InventoryMovementType,
  OrderStatus,
  PaymentStatus,
  PlatformRole,
  PrismaClient,
  ProductStatus,
  ShipmentStatus,
} from "@prisma/client";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME } from "@ishopine/shared";
import { runCheckout, type CheckoutInput } from "./checkout";
import {
  beginIdempotency,
  completeIdempotency,
  failIdempotency,
  hashCheckoutBody,
} from "./idempotency";
import {
  accountingPostRemoteEnabled,
  affiliatesSettleRemoteEnabled,
  billingUsageRemoteEnabled,
  inventoryReserveRemoteEnabled,
  logisticsLabelRemoteEnabled,
  remoteAffiliateConversion,
  remoteCreateLabel,
  remoteFulfillStock,
  remoteMarkDelivered,
  remoteRecordOrderRevenue,
  remoteRecordUsage,
  remoteReleaseStock,
  remoteWalletSettleOrder,
  walletSettleRemoteEnabled,
} from "./remote";

const prisma = new PrismaClient();
const jwtSecret = process.env.JWT_SECRET || "";
const orgSlug = process.env.PLATFORM_ORG_SLUG || "ishopine";
const inventoryRemote = () => inventoryReserveRemoteEnabled();
const logisticsRemote = () => logisticsLabelRemoteEnabled();
const accountingRemote = () => accountingPostRemoteEnabled();
const isProd = process.env.NODE_ENV === "production";

type JwtPayload = {
  sub: string;
  platformRole?: PlatformRole;
  tfa?: boolean;
};

type DbUser = {
  id: string;
  platformRole: PlatformRole;
  totpEnabled: boolean;
  canSell: boolean;
};

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

function verifyJwt(req: http.IncomingMessage): JwtPayload | null {
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

async function loadUser(userId: string): Promise<DbUser | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      platformRole: true,
      totpEnabled: true,
      canSell: true,
    },
  });
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

/** Mirror Nest TwoFactorGuard for seller/staff mutations. */
async function assertSeller2fa(user: DbUser, jwtUser: JwtPayload) {
  if (user.totpEnabled) {
    if (!jwtUser.tfa) {
      const err = new Error(
        "Autenticação de dois fatores necessária. Complete o login 2FA.",
      );
      (err as Error & { status: number }).status = 403;
      throw err;
    }
    return;
  }

  const elevated =
    user.platformRole === PlatformRole.PLATFORM_ADMIN ||
    user.platformRole === PlatformRole.PLATFORM_OPERATOR ||
    user.canSell;

  let isSellerMember = user.canSell;
  if (!isSellerMember) {
    const membership = await prisma.shopMember.findFirst({
      where: { userId: user.id, isActive: true },
      select: { id: true },
    });
    isSellerMember = Boolean(membership);
  }

  if (!elevated && !isSellerMember) return;

  const settings = await prisma.platformSettings.findFirst({
    where: { organization: { slug: orgSlug } },
  });
  if ((settings?.requireSeller2fa ?? true) && isProd) {
    const err = new Error(
      "Configure a autenticação de dois fatores antes de acessar o painel.",
    );
    (err as Error & { status: number }).status = 403;
    throw err;
  }
}

function httpError(status: number, message: string) {
  const err = new Error(message);
  (err as Error & { status: number }).status = status;
  return err;
}

/* ── Cart (Nest CartService parity) ── */

async function ensureCart(userId: string) {
  return prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

async function getCart(userId: string) {
  const cart = await ensureCart(userId);
  const full = await prisma.cart.findUnique({
    where: { id: cart.id },
    include: {
      items: {
        include: {
          product: {
            include: {
              shop: {
                select: { id: true, name: true, slug: true, status: true },
              },
              images: {
                orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
                take: 1,
              },
            },
          },
        },
      },
    },
  });
  const items = full?.items ?? [];
  const subtotalCents = items.reduce(
    (sum, item) => sum + item.quantity * item.product.priceCents,
    0,
  );
  return { ...full, subtotalCents, itemCount: items.length };
}

async function addCartItem(userId: string, productId: string, quantity = 1) {
  if (quantity < 1) throw httpError(400, "Quantidade inválida");
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.status !== ProductStatus.ACTIVE) {
    throw httpError(404, "Produto indisponível");
  }
  if (product.stock - product.reservedStock < quantity) {
    throw httpError(400, "Estoque insuficiente");
  }
  const cart = await ensureCart(userId);
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
  });
  const nextQty = (existing?.quantity ?? 0) + quantity;
  if (product.stock - product.reservedStock < nextQty) {
    throw httpError(400, "Estoque insuficiente");
  }
  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId } },
    create: { cartId: cart.id, productId, quantity },
    update: { quantity: nextQty },
  });
  return getCart(userId);
}

async function updateCartItem(
  userId: string,
  productId: string,
  quantity: number,
) {
  const cart = await ensureCart(userId);
  if (quantity <= 0) {
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id, productId },
    });
    return getCart(userId);
  }
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw httpError(404, "Produto não encontrado");
  if (product.stock - product.reservedStock < quantity) {
    throw httpError(400, "Estoque insuficiente");
  }
  await prisma.cartItem.update({
    where: { cartId_productId: { cartId: cart.id, productId } },
    data: { quantity },
  });
  return getCart(userId);
}

async function removeCartItem(userId: string, productId: string) {
  const cart = await ensureCart(userId);
  await prisma.cartItem.deleteMany({
    where: { cartId: cart.id, productId },
  });
  return getCart(userId);
}

async function clearCart(userId: string) {
  const cart = await ensureCart(userId);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  return getCart(userId);
}

/* ── Shipment side-effects (Nest LogisticsService parity, same DB) ── */

function resolveTrackingCode(
  carrierCode: CarrierCode,
  orderNumber: string,
  sellerTracking?: string,
) {
  if (carrierCode === CarrierCode.MANUAL) {
    const code = sellerTracking?.trim();
    if (!code) {
      throw httpError(
        400,
        "Envio MANUAL exige trackingCode fornecido pelo vendedor",
      );
    }
    return code;
  }
  if (carrierCode === CarrierCode.STORE_PICKUP) {
    return `ISH-PICKUP-${orderNumber}`;
  }
  if (carrierCode === CarrierCode.FREE_THRESHOLD) {
    return `ISH-FREE-${orderNumber}`;
  }
  return `ISH-${orderNumber}`;
}

async function createLabelForOrder(orderId: string) {
  const shipment = await prisma.shipment.findFirst({
    where: { orderId, status: { not: ShipmentStatus.CANCELLED } },
    orderBy: { createdAt: "desc" },
    include: { order: { select: { orderNumber: true } } },
  });
  if (!shipment) return null;
  const code = resolveTrackingCode(
    shipment.carrierCode,
    shipment.order.orderNumber,
  );
  const updated = await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      status: ShipmentStatus.LABEL_CREATED,
      trackingCode: code,
      labelUrl: `/api/logistics/shipments/${shipment.id}/label`,
      shippedAt: new Date(),
      events: {
        create: {
          status: ShipmentStatus.LABEL_CREATED,
          note: `Etiqueta gerada · ${code}`,
        },
      },
    },
  });
  await prisma.outboxMessage.create({
    data: {
      aggregateType: "shipment",
      aggregateId: updated.id,
      eventType: "shipping.label.created",
      payload: {
        shipmentId: updated.id,
        orderId,
        carrierCode: updated.carrierCode,
        trackingCode: updated.trackingCode,
      },
    },
  });
  return updated;
}

async function markShipmentDelivered(orderId: string) {
  const shipment = await prisma.shipment.findFirst({
    where: { orderId, status: { not: ShipmentStatus.CANCELLED } },
    orderBy: { createdAt: "desc" },
  });
  if (!shipment) return null;
  return prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      status: ShipmentStatus.DELIVERED,
      deliveredAt: new Date(),
      events: {
        create: { status: ShipmentStatus.DELIVERED, note: "Entregue" },
      },
    },
  });
}

/* ── Order status (Nest OrdersService.updateStatus parity) ── */

async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  operatorId: string,
) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, payments: true },
  });
  if (!order) throw httpError(404, "Pedido não encontrado");

  const updated = await prisma.$transaction(async (tx) => {
    const data: {
      status: OrderStatus;
      shippedAt?: Date;
      deliveredAt?: Date;
      cancelledAt?: Date;
      paymentStatus?: PaymentStatus;
    } = { status };

    if (status === OrderStatus.SHIPPED) data.shippedAt = new Date();
    if (status === OrderStatus.DELIVERED) data.deliveredAt = new Date();

    if (status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED) {
      data.cancelledAt = new Date();
      if (!inventoryRemote()) {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { reservedStock: { decrement: item.quantity } },
          });
          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              type: InventoryMovementType.RELEASE,
              quantity: item.quantity,
              reason: `Liberação por cancelamento do pedido ${order.orderNumber}`,
              reference: order.id,
              operatorId,
            },
          });
        }
      }
    }

    const shouldFulfill =
      (status === OrderStatus.CONFIRMED ||
        status === OrderStatus.PROCESSING) &&
      order.paymentStatus !== PaymentStatus.PAID;

    if (shouldFulfill) {
      data.paymentStatus = PaymentStatus.PAID;
      await tx.payment.updateMany({
        where: { orderId: order.id },
        data: { status: PaymentStatus.PAID, paidAt: new Date() },
      });
      if (!inventoryRemote()) {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { decrement: item.quantity },
              reservedStock: { decrement: item.quantity },
            },
          });
          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              type: InventoryMovementType.OUT,
              quantity: item.quantity,
              reason: `Saída por pedido ${order.orderNumber}`,
              reference: order.id,
              operatorId,
            },
          });
        }
      }
      if (!accountingRemote()) {
        const cashAccount = await tx.accountingAccount.findUnique({
          where: { code: "1.1.01" },
        });
        const revenueAccount = await tx.accountingAccount.findUnique({
          where: { code: "3.1.01" },
        });
        if (cashAccount && revenueAccount) {
          const existing = await tx.accountingEntry.findFirst({
            where: { orderId: order.id, type: AccountingEntryType.REVENUE },
          });
          if (!existing) {
            const entryCount = await tx.accountingEntry.count();
            await tx.accountingEntry.create({
              data: {
                entryNumber: `LC${String(entryCount + 1).padStart(6, "0")}`,
                description: `Receita do pedido ${order.orderNumber}`,
                type: AccountingEntryType.REVENUE,
                status: AccountingEntryStatus.POSTED,
                amountCents: order.totalCents,
                debitAccountId: cashAccount.id,
                creditAccountId: revenueAccount.id,
                orderId: order.id,
                createdById: operatorId,
                reviewedById: operatorId,
                postedAt: new Date(),
              },
            });
          }
        }
      }
    }

    return tx.order.update({
      where: { id },
      data,
      include: {
        items: true,
        payments: true,
        buyer: { select: { id: true, name: true, email: true } },
        sellerShop: { select: { id: true, name: true, slug: true } },
      },
    });
  });

  if (inventoryRemote()) {
    const items = order.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }));
    if (status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED) {
      await remoteReleaseStock({
        orderId: id,
        orderNumber: order.orderNumber,
        items,
        operatorId,
      });
    }
    const shouldFulfillRemote =
      (status === OrderStatus.CONFIRMED ||
        status === OrderStatus.PROCESSING) &&
      order.paymentStatus !== PaymentStatus.PAID;
    if (shouldFulfillRemote) {
      await remoteFulfillStock({
        orderId: id,
        orderNumber: order.orderNumber,
        items,
        operatorId,
      });
    }
  }

  if (
    accountingRemote() &&
    (status === OrderStatus.CONFIRMED ||
      status === OrderStatus.PROCESSING) &&
    order.paymentStatus !== PaymentStatus.PAID
  ) {
    await remoteRecordOrderRevenue({
      orderId: id,
      orderNumber: order.orderNumber,
      amountCents: order.totalCents,
      operatorId,
    });
  }

  if (status === OrderStatus.SHIPPED) {
    try {
      if (logisticsRemote()) {
        await remoteCreateLabel(id);
      } else {
        await createLabelForOrder(id);
      }
    } catch (error) {
      console.error("[orders] shipment label failed", id, error);
    }
  }
  if (status === OrderStatus.DELIVERED) {
    try {
      if (logisticsRemote()) {
        await remoteMarkDelivered(id);
      } else {
        await markShipmentDelivered(id);
      }
    } catch (error) {
      console.error("[orders] shipment deliver failed", id, error);
    }
  }

  return updated;
}

/**
 * Phase 30: Nest OrdersService.settlePaidOrders parity — after PaySuite PAID.
 * Affiliates / wallet / billing usage prefer remotes when configured.
 */
async function settlePaidOrders(orderIds: string[]) {
  for (const id of orderIds) {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) continue;
    if (order.paymentStatus === PaymentStatus.PAID) continue;

    await updateOrderStatus(id, OrderStatus.CONFIRMED, order.buyerId);

    if (order.affiliateCode) {
      try {
        if (affiliatesSettleRemoteEnabled()) {
          await remoteAffiliateConversion({
            code: order.affiliateCode,
            orderId: order.id,
            amountCents: order.subtotalCents,
          });
        }
      } catch (error) {
        console.error("[orders] affiliate conversion failed", order.id, error);
      }
    }

    const sellerNetCents = Math.max(
      0,
      order.totalCents - order.platformFeeCents,
    );
    try {
      if (walletSettleRemoteEnabled()) {
        await remoteWalletSettleOrder({
          orderId: order.id,
          orderNumber: order.orderNumber,
          sellerShopId: order.sellerShopId,
          sellerNetCents,
          platformFeeCents: order.platformFeeCents,
        });
      }
    } catch (error) {
      console.error("[orders] wallet settle failed", order.id, error);
    }

    const tenant = await prisma.tenant.findUnique({
      where: { shopId: order.sellerShopId },
    });
    if (tenant && billingUsageRemoteEnabled()) {
      try {
        await remoteRecordUsage({
          tenantId: tenant.id,
          metric: "ORDERS",
          quantity: 1,
          reference: order.id,
        });
      } catch (error) {
        console.error("[orders] usage record failed", order.id, error);
      }
    }
  }
}

function assertInternalSecret(req: http.IncomingMessage) {
  const secret =
    process.env.INTERNAL_SERVICE_SECRET || process.env.CRON_SECRET || "";
  if (!secret) {
    throw httpError(401, "Internal secret not configured");
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    throw httpError(401, "Invalid internal secret");
  }
}

async function assertCanUpdateStatus(
  jwtUser: JwtPayload,
  orderId: string,
  tenantId: string | null,
) {
  const user = await loadUser(jwtUser.sub);
  if (!user) throw httpError(401, "Não autenticado");

  const isPlatform =
    user.platformRole === PlatformRole.PLATFORM_ADMIN ||
    user.platformRole === PlatformRole.PLATFORM_OPERATOR;

  const allowedRole =
    isPlatform || user.platformRole === PlatformRole.SELLER;
  if (!allowedRole) {
    throw httpError(403, "Acesso não autorizado para este perfil");
  }

  await assertSeller2fa(user, jwtUser);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      sellerShop: {
        select: {
          id: true,
          ownerId: true,
          members: {
            where: { userId: user.id, isActive: true },
            select: { id: true },
          },
        },
      },
    },
  });
  if (!order) throw httpError(404, "Pedido não encontrado");

  if (!isPlatform) {
    const isSeller =
      order.sellerShop.ownerId === user.id ||
      order.sellerShop.members.length > 0;
    if (!isSeller) throw httpError(403, "Sem acesso a este pedido");

    if (tenantId) {
      const shopId = await resolveTenantShopId(user.id, tenantId);
      if (!shopId) throw httpError(403, "Sem acesso a este tenant");
      if (shopId !== order.sellerShopId) {
        throw httpError(403, "Pedido não pertence ao tenant activo");
      }
    }
  }

  return user;
}

function statusFromBody(body: unknown): OrderStatus {
  const status =
    body && typeof body === "object" && "status" in body
      ? String((body as { status: unknown }).status)
      : "";
  if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
    throw httpError(400, `Status inválido: ${status || "(vazio)"}`);
  }
  return status as OrderStatus;
}

/* ── Router ── */

export async function handleOwnedOrders(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const path = pathOnly(req.url);
  const method = req.method || "GET";

  try {
    /* Internal settle after PaySuite PAID (Phase 30 — was Nest fallthrough) */
    if (path === "/api/orders/internal/settle-paid" && method === "POST") {
      assertInternalSecret(req);
      const body = (await readJsonBody(req)) as { orderIds?: string[] };
      if (!Array.isArray(body.orderIds) || body.orderIds.length === 0) {
        json(res, 200, { ok: false, message: "orderIds obrigatório" });
        return true;
      }
      await settlePaidOrders(body.orderIds);
      json(res, 200, { ok: true, settled: body.orderIds.length });
      return true;
    }

    /* Cart */
    if (path === "/api/cart" && method === "GET") {
      const jwtUser = verifyJwt(req);
      if (!jwtUser) {
        json(res, 401, { message: "Não autenticado" });
        return true;
      }
      json(res, 200, await getCart(jwtUser.sub));
      return true;
    }
    if (path === "/api/cart/items" && method === "POST") {
      const jwtUser = verifyJwt(req);
      if (!jwtUser) {
        json(res, 401, { message: "Não autenticado" });
        return true;
      }
      const body = (await readJsonBody(req)) as {
        productId?: string;
        quantity?: number;
      };
      if (!body.productId) throw httpError(400, "productId obrigatório");
      json(
        res,
        200,
        await addCartItem(jwtUser.sub, body.productId, body.quantity ?? 1),
      );
      return true;
    }
    const cartItemMatch = path.match(/^\/api\/cart\/items\/([^/]+)$/);
    if (cartItemMatch && method === "PATCH") {
      const jwtUser = verifyJwt(req);
      if (!jwtUser) {
        json(res, 401, { message: "Não autenticado" });
        return true;
      }
      const body = (await readJsonBody(req)) as { quantity?: number };
      if (typeof body.quantity !== "number") {
        throw httpError(400, "quantity obrigatório");
      }
      json(
        res,
        200,
        await updateCartItem(jwtUser.sub, cartItemMatch[1], body.quantity),
      );
      return true;
    }
    if (cartItemMatch && method === "DELETE") {
      const jwtUser = verifyJwt(req);
      if (!jwtUser) {
        json(res, 401, { message: "Não autenticado" });
        return true;
      }
      json(res, 200, await removeCartItem(jwtUser.sub, cartItemMatch[1]));
      return true;
    }
    if (path === "/api/cart" && method === "DELETE") {
      const jwtUser = verifyJwt(req);
      if (!jwtUser) {
        json(res, 401, { message: "Não autenticado" });
        return true;
      }
      json(res, 200, await clearCart(jwtUser.sub));
      return true;
    }

    /* Order status write */
    const statusMatch = path.match(/^\/api\/orders\/([^/]+)\/status$/);
    if (statusMatch && method === "PATCH") {
      const jwtUser = verifyJwt(req);
      if (!jwtUser) {
        json(res, 401, { message: "Não autenticado" });
        return true;
      }
      const tenantHeader = req.headers["x-tenant-id"];
      const tenantId =
        typeof tenantHeader === "string" && tenantHeader
          ? tenantHeader
          : null;
      const user = await assertCanUpdateStatus(
        jwtUser,
        statusMatch[1],
        tenantId,
      );
      const body = await readJsonBody(req);
      const status = statusFromBody(body);
      const updated = await updateOrderStatus(
        statusMatch[1],
        status,
        user.id,
      );
      json(res, 200, updated);
      return true;
    }

    /* Checkout write */
    if (path === "/api/orders/checkout" && method === "POST") {
      const jwtUser = verifyJwt(req);
      if (!jwtUser) {
        json(res, 401, { message: "Não autenticado" });
        return true;
      }
      const body = (await readJsonBody(req)) as CheckoutInput;
      const idemKeyHeader = req.headers["idempotency-key"];
      const idemKey =
        typeof idemKeyHeader === "string" ? idemKeyHeader : undefined;
      const begin = await beginIdempotency(
        prisma,
        idemKey,
        hashCheckoutBody(body),
      );
      if (begin.kind === "replay") {
        res.writeHead(begin.responseCode, {
          "Content-Type": "application/json",
          "X-Idempotent-Replayed": "1",
        });
        res.end(JSON.stringify(begin.responseBody));
        return true;
      }
      if (begin.kind === "in_flight") {
        json(res, 409, { message: "Checkout já em progresso (idempotency)" });
        return true;
      }
      const startedKey = begin.kind === "started" ? begin.key : null;
      try {
        const result = await runCheckout(jwtUser.sub, body);
        if (startedKey) {
          await completeIdempotency(prisma, startedKey, 201, result);
        }
        json(res, 201, result);
      } catch (error) {
        if (startedKey) {
          await failIdempotency(prisma, startedKey).catch(() => undefined);
        }
        throw error;
      }
      return true;
    }

    /* Order reads (Phase 8) */
    if (method !== "GET") return false;

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

    const jwtUser = verifyJwt(req);
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
        typeof tenantHeader === "string" && tenantHeader
          ? tenantHeader
          : null;
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
      const user = await loadUser(jwtUser.sub);
      const platformRole = user?.platformRole ?? PlatformRole.BUYER;
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
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status: number }).status)
        : 400;
    json(res, status || 400, {
      message: error instanceof Error ? error.message : "Erro",
    });
    return true;
  }
}
