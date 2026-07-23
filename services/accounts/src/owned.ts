/**
 * Phase 16–26: accounts strangler — me, tenants, addresses (Phase 26).
 */
import http from "node:http";
import {
  TenantMemberRole,
  TenantType,
  PrismaClient,
} from "@prisma/client";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME, TENANT_HEADER } from "@ishopine/shared";

const prisma = new PrismaClient();
const jwtSecret = process.env.JWT_SECRET || "";

type JwtPayload = { sub: string };

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

function pathOnly(url?: string) {
  return (url || "/").split("?")[0];
}

function headerValue(
  req: http.IncomingMessage,
  name: string,
): string | undefined {
  const raw = req.headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0];
  return raw;
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

function requireUserId(req: http.IncomingMessage): string {
  const payload = verifyJwt(req);
  if (!payload?.sub) throw new HttpError(401, "Não autenticado");
  return payload.sub;
}

async function ensureAccountForUser(userId: string) {
  const existing = await prisma.account.findUnique({
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

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, "Utilizador não encontrado");

  return prisma.account.create({
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

async function listTenants(accountId: string) {
  const memberships = await prisma.tenantMembership.findMany({
    where: { accountId, isActive: true, tenant: { isActive: true } },
    include: { tenant: true },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({
    membershipId: m.id,
    role: m.role,
    tenant: m.tenant,
  }));
}

function slugify(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "tenant"
  );
}

async function uniqueTenantSlug(base: string) {
  let slug = base;
  let i = 0;
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    i += 1;
    slug = `${base}-${i}`;
  }
  return slug;
}

async function createParticularTenant(accountId: string, name?: string) {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new HttpError(404, "Conta não encontrada");

  const existing = await prisma.tenant.findUnique({
    where: { particularAccountId: accountId },
  });
  if (existing) {
    throw new HttpError(400, "Esta conta já tem um tenant PARTICULAR");
  }

  const slugBase = slugify(name || account.name || "particular");
  const slug = await uniqueTenantSlug(`p-${slugBase}`);

  return prisma.$transaction(async (tx) => {
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

async function createStoreTenant(
  accountId: string,
  input: { name: string; shopId?: string },
) {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new HttpError(404, "Conta não encontrada");

  if (input.shopId) {
    const shop = await prisma.shop.findUnique({ where: { id: input.shopId } });
    if (!shop) throw new HttpError(404, "Loja não encontrada");
    if (shop.ownerId !== account.userId) {
      throw new HttpError(403, "Loja não pertence a esta conta");
    }
    const linked = await prisma.tenant.findUnique({
      where: { shopId: input.shopId },
    });
    if (linked) {
      throw new HttpError(400, "Esta loja já tem tenant STORE");
    }
  }

  const slug = await uniqueTenantSlug(`s-${slugify(input.name)}`);

  return prisma.$transaction(async (tx) => {
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

async function resolveTenantAccess(accountId: string, tenantId: string) {
  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_accountId: { tenantId, accountId } },
    include: { tenant: true },
  });

  if (!membership?.isActive || !membership.tenant.isActive) {
    throw new HttpError(403, "Sem acesso a este tenant");
  }

  return {
    tenantId: membership.tenant.id,
    tenantType: membership.tenant.type,
    tenantSlug: membership.tenant.slug,
    membershipRole: membership.role,
    shopId: membership.tenant.shopId,
  };
}

export async function handleOwnedAccounts(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const path = pathOnly(req.url);
  const method = (req.method || "GET").toUpperCase();

  const isAccounts = path.startsWith("/api/accounts");
  const isAddresses =
    path === "/api/addresses" || path.startsWith("/api/addresses/");
  if (!isAccounts && !isAddresses) {
    return false;
  }

  try {
    // Phase 26: buyer address book (was Nest users.controller).
    if (method === "GET" && path === "/api/addresses") {
      const userId = requireUserId(req);
      json(
        res,
        200,
        await prisma.address.findMany({
          where: { userId },
          orderBy: { isDefault: "desc" },
        }),
      );
      return true;
    }

    if (method === "POST" && path === "/api/addresses") {
      const userId = requireUserId(req);
      const body = await readJsonBody(req);
      if (typeof body.street !== "string" || !body.street.trim()) {
        throw new HttpError(400, "street obrigatório");
      }
      if (typeof body.number !== "string" || !body.number.trim()) {
        throw new HttpError(400, "number obrigatório");
      }
      if (typeof body.district !== "string" || !body.district.trim()) {
        throw new HttpError(400, "district obrigatório");
      }
      if (typeof body.city !== "string" || !body.city.trim()) {
        throw new HttpError(400, "city obrigatório");
      }
      if (typeof body.state !== "string" || !body.state.trim()) {
        throw new HttpError(400, "state obrigatório");
      }
      if (typeof body.zipCode !== "string" || !body.zipCode.trim()) {
        throw new HttpError(400, "zipCode obrigatório");
      }
      const isDefault = body.isDefault === true;
      if (isDefault) {
        await prisma.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }
      json(
        res,
        201,
        await prisma.address.create({
          data: {
            userId,
            label:
              typeof body.label === "string" && body.label.trim()
                ? body.label.trim()
                : "Principal",
            street: body.street.trim(),
            number: body.number.trim(),
            complement:
              typeof body.complement === "string" ? body.complement : undefined,
            district: body.district.trim(),
            city: body.city.trim(),
            state: body.state.trim(),
            zipCode: body.zipCode.trim(),
            isDefault,
          },
        }),
      );
      return true;
    }

    if (method === "GET" && path === "/api/accounts/me") {
      const userId = requireUserId(req);
      const account = await ensureAccountForUser(userId);
      const tenants = await listTenants(account.id);
      json(res, 200, {
        account: {
          id: account.id,
          email: account.email,
          name: account.name,
          phone: account.phone,
        },
        tenants,
        platformStaffRole: account.platformStaff?.role ?? null,
      });
      return true;
    }

    if (method === "POST" && path === "/api/accounts/tenants/particular") {
      const userId = requireUserId(req);
      const body = await readJsonBody(req);
      const account = await ensureAccountForUser(userId);
      const tenant = await createParticularTenant(
        account.id,
        typeof body.name === "string" ? body.name : undefined,
      );
      json(res, 201, { tenant });
      return true;
    }

    if (method === "POST" && path === "/api/accounts/tenants/store") {
      const userId = requireUserId(req);
      const body = await readJsonBody(req);
      if (typeof body.name !== "string" || !body.name.trim()) {
        throw new HttpError(400, "Nome da loja obrigatório");
      }
      const account = await ensureAccountForUser(userId);
      const tenant = await createStoreTenant(account.id, {
        name: body.name,
        shopId: typeof body.shopId === "string" ? body.shopId : undefined,
      });
      json(res, 201, { tenant });
      return true;
    }

    if (method === "GET" && path === "/api/accounts/tenants/active") {
      const userId = requireUserId(req);
      const tenantId = headerValue(req, TENANT_HEADER);
      if (!tenantId) {
        json(res, 200, { tenant: null });
        return true;
      }
      const account = await ensureAccountForUser(userId);
      const tenant = await resolveTenantAccess(account.id, tenantId);
      json(res, 200, { tenant });
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
    console.error("[accounts] owned error", error);
    json(res, 500, "Erro interno de accounts");
    return true;
  }
}
