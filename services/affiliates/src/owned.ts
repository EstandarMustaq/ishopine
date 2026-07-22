/**
 * Phase 14: affiliate strangler — links, clicks, rewards, staff approve/pay,
 * and internal register-conversion (Nest settle remote).
 */
import http from "node:http";
import { randomBytes } from "node:crypto";
import {
  AffiliateRewardStatus,
  PlatformRole,
  PrismaClient,
} from "@prisma/client";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME } from "@ishopine/shared";

const prisma = new PrismaClient();
const jwtSecret = process.env.JWT_SECRET || "";
const internalSecret =
  process.env.INTERNAL_SERVICE_SECRET || process.env.CRON_SECRET || "";
const orgSlug = process.env.PLATFORM_ORG_SLUG || "ishopine";
const isProd = process.env.NODE_ENV === "production";

type JwtPayload = { sub: string; tfa?: boolean };

type DbUser = {
  id: string;
  platformRole: PlatformRole;
  totpEnabled: boolean;
  canBuy: boolean;
  emailVerifiedAt: Date | null;
  isActive: boolean;
  affiliateEligible: boolean;
  canSell: boolean;
};

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

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

function verifyInternal(req: http.IncomingMessage): boolean {
  if (!internalSecret) return false;
  const auth = req.headers.authorization;
  if (!auth?.toLowerCase().startsWith("bearer ")) return false;
  return auth.slice(7).trim() === internalSecret;
}

function pathOnly(url?: string) {
  return (url || "/").split("?")[0];
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  const errorName =
    status === 401
      ? "Unauthorized"
      : status === 403
        ? "Forbidden"
        : status === 404
          ? "Not Found"
          : status === 400
            ? "Bad Request"
            : "Error";
  const payload =
    status >= 400 && typeof body === "string"
      ? { statusCode: status, message: body, error: errorName }
      : status >= 400 &&
          body &&
          typeof body === "object" &&
          !("statusCode" in (body as object))
        ? {
            statusCode: status,
            message: (body as { message?: string }).message ?? body,
            error: errorName,
          }
        : body;
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        resolve(
          parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : {},
        );
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
      canBuy: true,
      emailVerifiedAt: true,
      isActive: true,
      affiliateEligible: true,
      canSell: true,
    },
  });
}

async function requireUser(req: http.IncomingMessage): Promise<{
  jwt: JwtPayload;
  user: DbUser;
}> {
  const payload = verifyJwt(req);
  if (!payload?.sub) throw new HttpError(401, "Não autenticado");
  const user = await loadUser(payload.sub);
  if (!user) throw new HttpError(401, "Não autenticado");
  return { jwt: payload, user };
}

async function assertEligible(user: DbUser) {
  if (!user.isActive || !user.canBuy || !user.emailVerifiedAt) {
    throw new HttpError(
      403,
      "Recompensas disponíveis apenas para clientes verificados e elegíveis",
    );
  }
  if (!user.affiliateEligible) {
    await prisma.user.update({
      where: { id: user.id },
      data: { affiliateEligible: true },
    });
  }
}

async function assertStaff2fa(user: DbUser, jwtUser: JwtPayload) {
  if (user.totpEnabled) {
    if (!jwtUser.tfa) {
      throw new HttpError(
        403,
        "Autenticação de dois fatores necessária. Complete o login 2FA.",
      );
    }
    return;
  }
  const settings = await prisma.platformSettings.findFirst({
    where: { organization: { slug: orgSlug } },
  });
  if ((settings?.requireSeller2fa ?? true) && isProd) {
    throw new HttpError(
      403,
      "Configure a autenticação de dois fatores antes de acessar o painel.",
    );
  }
}

async function assertPlatformStaff(req: http.IncomingMessage) {
  const { jwt: jwtUser, user } = await requireUser(req);
  if (
    user.platformRole !== PlatformRole.PLATFORM_ADMIN &&
    user.platformRole !== PlatformRole.PLATFORM_OPERATOR
  ) {
    throw new HttpError(403, "Acesso não autorizado para este perfil");
  }
  await assertStaff2fa(user, jwtUser);
  return user;
}

async function createLink(
  userId: string,
  data: { productId?: string; shopId?: string; label?: string },
) {
  const user = await loadUser(userId);
  if (!user) throw new HttpError(401, "Não autenticado");
  await assertEligible(user);

  if (!data.productId && !data.shopId) {
    throw new HttpError(400, "Informe um produto ou loja de empresa");
  }
  if (data.productId) {
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });
    if (!product) throw new HttpError(404, "Produto não encontrado");
  }
  if (data.shopId) {
    const shop = await prisma.shop.findUnique({ where: { id: data.shopId } });
    if (!shop) throw new HttpError(404, "Loja não encontrada");
  }

  const code = `is${randomBytes(4).toString("hex")}`;
  return prisma.affiliateLink.create({
    data: {
      userId,
      code,
      productId: data.productId,
      shopId: data.shopId,
      label: data.label,
    },
    include: {
      product: { select: { id: true, name: true, slug: true } },
      shop: { select: { id: true, name: true, slug: true } },
    },
  });
}

function listMine(userId: string) {
  return prisma.affiliateLink.findMany({
    where: { userId },
    include: {
      product: { select: { id: true, name: true, slug: true } },
      shop: { select: { id: true, name: true, slug: true } },
      _count: { select: { rewards: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function summary(userId: string) {
  const user = await loadUser(userId);
  if (!user) throw new HttpError(401, "Não autenticado");
  await assertEligible(user);

  const [links, linkRows, pending, earned] = await Promise.all([
    prisma.affiliateLink.count({ where: { userId, isActive: true } }),
    prisma.affiliateLink.findMany({
      where: { userId },
      select: { clicks: true },
    }),
    prisma.affiliateReward.aggregate({
      where: { earnerId: userId, status: AffiliateRewardStatus.PENDING },
      _sum: { amountCents: true },
    }),
    prisma.affiliateReward.aggregate({
      where: {
        earnerId: userId,
        status: {
          in: [AffiliateRewardStatus.APPROVED, AffiliateRewardStatus.PAID],
        },
      },
      _sum: { amountCents: true },
    }),
  ]);

  const clicks = linkRows.reduce((n, l) => n + l.clicks, 0);
  const pendingCents = pending._sum.amountCents ?? 0;
  const earnedCents = earned._sum.amountCents ?? 0;
  return {
    eligible: true,
    activeLinks: links,
    linksCount: links,
    clicks,
    pendingCents,
    earnedCents,
    commissionsCents: pendingCents + earnedCents,
    paidCents: earnedCents,
  };
}

async function trackClick(code: string) {
  const link = await prisma.affiliateLink.findUnique({
    where: { code },
    include: {
      product: { select: { id: true, slug: true, name: true } },
      shop: { select: { id: true, slug: true, name: true } },
    },
  });
  if (!link?.isActive) throw new HttpError(404, "Link inválido");

  await prisma.affiliateLink.update({
    where: { id: link.id },
    data: { clicks: { increment: 1 } },
  });

  let href = "/produtos";
  if (link.product?.slug) {
    href = `/produtos/${link.product.slug}`;
  } else if (link.shop?.slug) {
    href = `/lojas/${link.shop.slug}`;
  }

  return {
    code: link.code,
    productId: link.productId,
    shopId: link.shopId,
    product: link.product,
    shop: link.shop,
    href,
  };
}

async function listRewards(userId: string) {
  const user = await loadUser(userId);
  if (!user) throw new HttpError(401, "Não autenticado");
  await assertEligible(user);

  return prisma.affiliateReward.findMany({
    where: { earnerId: userId },
    include: {
      link: {
        select: {
          code: true,
          label: true,
          product: { select: { name: true, slug: true } },
          shop: { select: { name: true, slug: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function registerConversion(input: {
  code?: string | null;
  orderId?: string;
  amountCents: number;
}) {
  if (!input.code) return null;
  const link = await prisma.affiliateLink.findUnique({
    where: { code: input.code },
  });
  if (!link?.isActive) return null;

  if (input.orderId) {
    const existing = await prisma.affiliateReward.findFirst({
      where: { orderId: input.orderId, linkId: link.id },
    });
    if (existing) return existing;
  }

  const amountCents = Math.max(
    0,
    Math.round((input.amountCents * link.rewardBps) / 10_000),
  );
  if (amountCents <= 0) return null;

  return prisma.$transaction(async (tx) => {
    const created = await tx.affiliateReward.create({
      data: {
        linkId: link.id,
        earnerId: link.userId,
        orderId: input.orderId,
        amountCents,
        status: AffiliateRewardStatus.PENDING,
      },
    });
    await tx.affiliateLink.update({
      where: { id: link.id },
      data: {
        conversions: { increment: 1 },
        pendingCents: { increment: amountCents },
        earnedCents: { increment: amountCents },
      },
    });
    return created;
  });
}

async function approveReward(rewardId: string) {
  const reward = await prisma.affiliateReward.findUnique({
    where: { id: rewardId },
  });
  if (!reward) throw new HttpError(404, "Recompensa não encontrada");
  if (reward.status !== AffiliateRewardStatus.PENDING) {
    throw new HttpError(400, "Só recompensas PENDING podem ser aprovadas");
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.affiliateReward.update({
      where: { id: rewardId },
      data: { status: AffiliateRewardStatus.APPROVED },
    });
    await tx.affiliateLink.update({
      where: { id: reward.linkId },
      data: { pendingCents: { decrement: reward.amountCents } },
    });
    return updated;
  });
}

async function markRewardPaid(rewardId: string, note?: string) {
  const reward = await prisma.affiliateReward.findUnique({
    where: { id: rewardId },
  });
  if (!reward) throw new HttpError(404, "Recompensa não encontrada");
  if (
    reward.status !== AffiliateRewardStatus.APPROVED &&
    reward.status !== AffiliateRewardStatus.PENDING
  ) {
    throw new HttpError(
      400,
      "Só recompensas APPROVED (ou PENDING) podem ser marcadas como pagas",
    );
  }
  return prisma.$transaction(async (tx) => {
    const wasPending = reward.status === AffiliateRewardStatus.PENDING;
    const updated = await tx.affiliateReward.update({
      where: { id: rewardId },
      data: {
        status: AffiliateRewardStatus.PAID,
        note: note ?? reward.note,
      },
    });
    await tx.affiliateLink.update({
      where: { id: reward.linkId },
      data: wasPending
        ? { pendingCents: { decrement: reward.amountCents } }
        : {},
    });
    return updated;
  });
}

export async function handleOwnedAffiliates(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const path = pathOnly(req.url);
  const method = (req.method || "GET").toUpperCase();

  if (!path.startsWith("/api/affiliate")) {
    return false;
  }

  try {
    if (
      method === "POST" &&
      path === "/api/affiliate/internal/register-conversion"
    ) {
      if (!verifyInternal(req)) {
        json(res, 401, "Segredo interno inválido");
        return true;
      }
      const body = await readJsonBody(req);
      const code =
        typeof body.code === "string" ? body.code : null;
      const orderId =
        typeof body.orderId === "string" ? body.orderId : undefined;
      const amountCents =
        typeof body.amountCents === "number"
          ? body.amountCents
          : Number(body.amountCents);
      if (!Number.isFinite(amountCents)) {
        json(res, 400, "amountCents inválido");
        return true;
      }
      const reward = await registerConversion({ code, orderId, amountCents });
      json(res, 200, reward ?? { skipped: true });
      return true;
    }

    const clickMatch = path.match(/^\/api\/affiliate\/click\/([^/]+)$/);
    if (method === "POST" && clickMatch) {
      const code = decodeURIComponent(clickMatch[1]);
      json(res, 200, await trackClick(code));
      return true;
    }

    if (method === "GET" && path === "/api/affiliate/summary") {
      const { user } = await requireUser(req);
      json(res, 200, await summary(user.id));
      return true;
    }

    if (method === "GET" && path === "/api/affiliate/links") {
      const { user } = await requireUser(req);
      json(res, 200, await listMine(user.id));
      return true;
    }

    if (method === "POST" && path === "/api/affiliate/links") {
      const { user } = await requireUser(req);
      const body = await readJsonBody(req);
      const created = await createLink(user.id, {
        productId:
          typeof body.productId === "string" ? body.productId : undefined,
        shopId: typeof body.shopId === "string" ? body.shopId : undefined,
        label: typeof body.label === "string" ? body.label : undefined,
      });
      json(res, 201, created);
      return true;
    }

    if (method === "GET" && path === "/api/affiliate/rewards") {
      const { user } = await requireUser(req);
      json(res, 200, await listRewards(user.id));
      return true;
    }

    const approveMatch = path.match(
      /^\/api\/affiliate\/rewards\/([^/]+)\/approve$/,
    );
    if (method === "PATCH" && approveMatch) {
      await assertPlatformStaff(req);
      json(res, 200, await approveReward(approveMatch[1]));
      return true;
    }

    const payMatch = path.match(/^\/api\/affiliate\/rewards\/([^/]+)\/pay$/);
    if (method === "PATCH" && payMatch) {
      await assertPlatformStaff(req);
      const body = await readJsonBody(req);
      json(
        res,
        200,
        await markRewardPaid(
          payMatch[1],
          typeof body.note === "string" ? body.note : undefined,
        ),
      );
      return true;
    }

    return false;
  } catch (error) {
    if (error instanceof HttpError) {
      json(res, error.status, error.message);
      return true;
    }
    if (error instanceof SyntaxError) {
      json(res, 400, "JSON inválido");
      return true;
    }
    console.error("[affiliates] owned error", error);
    json(res, 500, "Erro interno de afiliados");
    return true;
  }
}
