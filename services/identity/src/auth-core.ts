/**
 * Phase 13–30: identity auth core — local + 2FA + me.
 * Google OAuth lives in google-oauth.ts (owned by identity).
 */
import { createHash, randomBytes, randomInt } from "node:crypto";
import {
  AuthProvider,
  PlatformRole,
  PrismaClient,
  VerificationPurpose,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { mailConfigured, sendVerificationCode } from "./mail";

const prisma = new PrismaClient();
const jwtSecret = process.env.JWT_SECRET || "";
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "7d";
const orgSlug = process.env.PLATFORM_ORG_SLUG || "ishopine";
const isProd = process.env.NODE_ENV === "production";

const CODE_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 10 * 60 * 1000;
const BACKUP_CODE_COUNT = 8;

export class AuthHttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthHttpError";
  }
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function requireJwtSecret() {
  if (!jwtSecret) {
    throw new AuthHttpError(500, "JWT_SECRET não configurado");
  }
}

async function resolveOrganization() {
  let org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "iShopine",
        slug: orgSlug,
        legalName: "iShopine, Lda",
        supportEmail: "contacto@ishopine.com",
        settings: {
          create: {
            marketplaceName: "iShopine",
            tagline: "Mercado moçambicano — compre e venda com confiança",
          },
        },
      },
    });
  }
  return org;
}

async function issueVerificationCode(
  email: string,
  purpose: VerificationPurpose,
  userId?: string,
) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = hash(code);

  await prisma.emailVerificationCode.updateMany({
    where: { email, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await prisma.emailVerificationCode.create({
    data: {
      email,
      userId,
      codeHash,
      purpose,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  const sendResult = await sendVerificationCode(
    email,
    code,
    purpose === VerificationPurpose.LOGIN_OTP
      ? "login"
      : "verificação de e-mail",
  );

  // Surface the code when mail is not delivered (misconfigured SMTP /
  // provider outage) so onboarding is not blocked. Prefer fixing SMTP.
  const exposeCode =
    !sendResult.delivered || (!isProd && !mailConfigured());

  return {
    code,
    delivered: sendResult.delivered,
    devCode: exposeCode ? code : undefined,
  };
}

function publicUser(user: {
  id: string;
  email: string;
  name: string;
  platformRole: PlatformRole;
  phone: string | null;
  avatarUrl: string | null;
  totpEnabled: boolean;
  emailVerifiedAt: Date | null;
  canBuy: boolean;
  canSell: boolean;
  affiliateEligible?: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    platformRole: user.platformRole,
    role: user.platformRole,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    totpEnabled: user.totpEnabled,
    emailVerifiedAt: user.emailVerifiedAt,
    canBuy: user.canBuy,
    canSell: user.canSell,
    affiliateEligible: Boolean(
      user.affiliateEligible || (user.canBuy && user.emailVerifiedAt),
    ),
  };
}

function tokenResponse(
  user: {
    id: string;
    email: string;
    name: string;
    platformRole: PlatformRole;
    phone: string | null;
    avatarUrl: string | null;
    totpEnabled: boolean;
    emailVerifiedAt: Date | null;
    canBuy: boolean;
    canSell: boolean;
  },
  tfa: boolean,
) {
  requireJwtSecret();
  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      platformRole: user.platformRole,
      emailVerified: Boolean(user.emailVerifiedAt),
      tfa,
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn as jwt.SignOptions["expiresIn"] },
  );

  return {
    accessToken,
    user: publicUser(user),
  };
}

async function consumeCode(
  email: string,
  purpose: VerificationPurpose,
  code: string,
  userId?: string,
) {
  const record = await prisma.emailVerificationCode.findFirst({
    where: {
      email,
      purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      ...(userId ? { userId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    throw new AuthHttpError(400, "Código inválido ou expirado");
  }

  if (record.attempts >= 5) {
    throw new AuthHttpError(
      400,
      "Muitas tentativas. Solicite um novo código.",
    );
  }

  const valid = record.codeHash === hash(code);
  await prisma.emailVerificationCode.update({
    where: { id: record.id },
    data: {
      attempts: { increment: 1 },
      ...(valid ? { consumedAt: new Date() } : {}),
    },
  });

  if (!valid) {
    throw new AuthHttpError(400, "Código inválido ou expirado");
  }
}

function verifyTotp(secret: string, token: string) {
  authenticator.options = { window: 1 };
  return authenticator.check(token.replace(/\s/g, ""), secret);
}

function isEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function register(body: Record<string, unknown>) {
  if (!isEmail(body.email)) {
    throw new AuthHttpError(400, "E-mail inválido");
  }
  if (typeof body.password !== "string" || body.password.length < 6) {
    throw new AuthHttpError(400, "Password deve ter pelo menos 6 caracteres");
  }
  if (typeof body.name !== "string" || body.name.trim().length < 2) {
    throw new AuthHttpError(400, "Nome inválido");
  }

  const org = await resolveOrganization();
  const email = body.email.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { organizationId_email: { organizationId: org.id, email } },
  });
  if (existing) {
    throw new AuthHttpError(409, "E-mail já cadastrado");
  }

  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email,
      passwordHash,
      name: body.name.trim(),
      phone: typeof body.phone === "string" ? body.phone : undefined,
      platformRole: PlatformRole.BUYER,
      authProvider: AuthProvider.LOCAL,
      cart: { create: {} },
    },
  });

  const { devCode, delivered } = await issueVerificationCode(
    email,
    VerificationPurpose.EMAIL_VERIFY,
    user.id,
  );

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "auth.register",
      entityType: "User",
      entityId: user.id,
    },
  });

  return {
    message: delivered
      ? "Conta criada. Verifique seu e-mail com o código de 6 dígitos antes de acessar."
      : "Conta criada. O envio de e-mail falhou temporariamente — use o código mostrado no ecrã de verificação.",
    email,
    requiresEmailVerification: true,
    ...(devCode ? { devCode } : {}),
  };
}

export async function verifyEmail(body: Record<string, unknown>) {
  if (!isEmail(body.email)) {
    throw new AuthHttpError(400, "E-mail inválido");
  }
  if (typeof body.code !== "string" || body.code.length !== 6) {
    throw new AuthHttpError(400, "Código inválido");
  }

  const org = await resolveOrganization();
  const email = body.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { organizationId_email: { organizationId: org.id, email } },
  });
  if (!user) {
    throw new AuthHttpError(400, "Usuário não encontrado");
  }

  if (user.emailVerifiedAt) {
    return tokenResponse(user, !user.totpEnabled);
  }

  await consumeCode(email, VerificationPurpose.EMAIL_VERIFY, body.code, user.id);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date() },
  });

  return tokenResponse(updated, !updated.totpEnabled);
}

export async function resendCode(body: Record<string, unknown>) {
  if (!isEmail(body.email)) {
    throw new AuthHttpError(400, "E-mail inválido");
  }

  const org = await resolveOrganization();
  const email = body.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { organizationId_email: { organizationId: org.id, email } },
  });

  if (!user) {
    return { message: "Se o e-mail existir, um novo código foi enviado." };
  }
  if (user.emailVerifiedAt) {
    return { message: "E-mail já verificado." };
  }

  const { devCode } = await issueVerificationCode(
    email,
    VerificationPurpose.EMAIL_VERIFY,
    user.id,
  );

  return {
    message: "Novo código enviado.",
    ...(devCode ? { devCode } : {}),
  };
}

export async function login(body: Record<string, unknown>) {
  if (!isEmail(body.email) || typeof body.password !== "string") {
    throw new AuthHttpError(401, "Credenciais inválidas");
  }

  const org = await resolveOrganization();
  const email = body.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { organizationId_email: { organizationId: org.id, email } },
  });

  if (!user || !user.isActive || !user.passwordHash) {
    throw new AuthHttpError(401, "Credenciais inválidas");
  }

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) {
    throw new AuthHttpError(401, "Credenciais inválidas");
  }

  if (!user.emailVerifiedAt) {
    const { devCode } = await issueVerificationCode(
      email,
      VerificationPurpose.EMAIL_VERIFY,
      user.id,
    );
    return {
      requiresEmailVerification: true,
      email,
      message: "Verifique seu e-mail antes de continuar.",
      ...(devCode ? { devCode } : {}),
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  if (user.totpEnabled) {
    const session = await prisma.authSession.create({
      data: {
        userId: user.id,
        pendingTwoFactor: true,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
    return {
      requiresTwoFactor: true,
      sessionToken: session.id,
      message: "Informe o código do autenticador.",
    };
  }

  return tokenResponse(user, false);
}

export async function verify2fa(body: Record<string, unknown>) {
  if (typeof body.sessionToken !== "string" || typeof body.code !== "string") {
    throw new AuthHttpError(400, "Dados 2FA inválidos");
  }
  if (body.code.length < 6) {
    throw new AuthHttpError(400, "Código inválido");
  }

  const session = await prisma.authSession.findUnique({
    where: { id: body.sessionToken },
    include: { user: true },
  });

  if (
    !session ||
    session.revokedAt ||
    !session.pendingTwoFactor ||
    session.expiresAt < new Date()
  ) {
    throw new AuthHttpError(401, "Sessão 2FA inválida ou expirada");
  }

  const user = session.user;
  if (!user.totpEnabled || !user.totpSecret) {
    throw new AuthHttpError(400, "2FA não está ativo nesta conta");
  }

  const code = body.code;
  const totpOk = verifyTotp(user.totpSecret, code);
  const backupOk =
    !totpOk && user.backupCodesHash.some((h) => h === hash(code));

  if (!totpOk && !backupOk) {
    throw new AuthHttpError(401, "Código 2FA inválido");
  }

  if (backupOk) {
    const codeHash = hash(code);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        backupCodesHash: user.backupCodesHash.filter((h) => h !== codeHash),
      },
    });
  }

  await prisma.authSession.update({
    where: { id: session.id },
    data: { pendingTwoFactor: false, revokedAt: new Date() },
  });

  return tokenResponse(user, true);
}

export async function setup2fa(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AuthHttpError(401, "Não autenticado");
  }

  const secret = authenticator.generateSecret();
  const issuer = "iShopine";
  const account = user.email.trim().toLowerCase();
  const uri = authenticator.keyuri(account, issuer, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(uri, {
    errorCorrectionLevel: "M",
    type: "image/png",
    margin: 1,
    width: 256,
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecret: secret,
      totpEnabled: false,
      totpVerifiedAt: null,
    },
  });

  return {
    secret,
    otpauthUrl: uri,
    qrCodeDataUrl,
    message:
      "Escaneie o QR no autenticador e confirme com um código em /auth/2fa/enable",
  };
}

export async function enable2fa(
  userId: string,
  body: Record<string, unknown>,
) {
  if (typeof body.code !== "string" || body.code.length !== 6) {
    throw new AuthHttpError(400, "Código inválido");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.totpSecret) {
    throw new AuthHttpError(400, "Inicie o setup 2FA primeiro");
  }

  if (!verifyTotp(user.totpSecret, body.code)) {
    throw new AuthHttpError(400, "Código inválido");
  }

  const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
    randomBytes(4).toString("hex"),
  );
  const backupCodesHash = backupCodes.map((code) => hash(code));

  await prisma.user.update({
    where: { id: userId },
    data: {
      totpEnabled: true,
      totpVerifiedAt: new Date(),
      backupCodesHash,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "auth.2fa.enable",
      entityType: "User",
      entityId: userId,
    },
  });

  requireJwtSecret();
  return {
    enabled: true,
    backupCodes,
    message:
      "2FA ativado. Guarde os códigos de backup — eles não serão mostrados novamente.",
    accessToken: jwt.sign(
      {
        sub: user.id,
        email: user.email,
        platformRole: user.platformRole,
        emailVerified: Boolean(user.emailVerifiedAt),
        tfa: true,
      },
      jwtSecret,
      { expiresIn: jwtExpiresIn as jwt.SignOptions["expiresIn"] },
    ),
  };
}

export async function disable2fa(
  userId: string,
  body: Record<string, unknown>,
) {
  if (typeof body.code !== "string" || body.code.length < 6) {
    throw new AuthHttpError(400, "Código inválido");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.totpEnabled || !user.totpSecret) {
    throw new AuthHttpError(400, "2FA não está ativo");
  }

  const totpOk = verifyTotp(user.totpSecret, body.code);
  const backupOk = user.backupCodesHash.includes(hash(body.code));
  if (!totpOk && !backupOk) {
    throw new AuthHttpError(401, "Código inválido");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      totpEnabled: false,
      totpSecret: null,
      totpVerifiedAt: null,
      backupCodesHash: [],
    },
  });

  return { enabled: false };
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      platformRole: true,
      phone: true,
      avatarUrl: true,
      totpEnabled: true,
      emailVerifiedAt: true,
      canBuy: true,
      canSell: true,
      affiliateEligible: true,
      createdAt: true,
      shopMemberships: {
        where: { isActive: true },
        include: {
          shop: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
            },
          },
        },
      },
      addresses: {
        orderBy: { isDefault: "desc" },
      },
    },
  });

  if (!user) {
    throw new AuthHttpError(401, "Não autenticado");
  }

  return {
    ...user,
    role: user.platformRole,
  };
}
