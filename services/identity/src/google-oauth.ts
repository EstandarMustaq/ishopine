/**
 * Phase 30: Google OAuth (Nest Passport parity) via Google's documented OAuth2.
 * No Passport — authorize → token → userinfo against Google OpenID endpoints.
 */
import { randomBytes } from "node:crypto";
import {
  AuthProvider,
  PlatformRole,
  PrismaClient,
} from "@prisma/client";
import jwt from "jsonwebtoken";
import { AuthHttpError } from "./auth-core";

const prisma = new PrismaClient();
const jwtSecret = process.env.JWT_SECRET || "";
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "7d";
const orgSlug = process.env.PLATFORM_ORG_SLUG || "ishopine";
const SESSION_TTL_MS = 10 * 60 * 1000;

export type GoogleProfileUser = {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  emailVerified: boolean;
};

export function googleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_CALLBACK_URL,
  );
}

function requireJwtSecret() {
  if (!jwtSecret) {
    throw new AuthHttpError(500, "JWT_SECRET não configurado");
  }
}

export function mintGoogleOAuthState(): string {
  requireJwtSecret();
  return jwt.sign(
    { purpose: "google_oauth", n: randomBytes(8).toString("hex") },
    jwtSecret,
    { expiresIn: "10m" },
  );
}

export function verifyGoogleOAuthState(state: string | undefined): boolean {
  if (!state || !jwtSecret) return false;
  try {
    const payload = jwt.verify(state, jwtSecret) as { purpose?: string };
    return payload.purpose === "google_oauth";
  } catch {
    return false;
  }
}

export function googleAuthorizeUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const callbackURL = process.env.GOOGLE_CALLBACK_URL!;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callbackURL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("access_type", "online");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

async function exchangeCode(code: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_CALLBACK_URL!,
      grant_type: "authorization_code",
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new AuthHttpError(
      502,
      data.error_description ||
        data.error ||
        "Falha ao trocar código Google OAuth",
    );
  }
  return data.access_token;
}

async function fetchGoogleProfile(
  accessToken: string,
): Promise<GoogleProfileUser> {
  const res = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  const data = (await res.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
    error?: string;
  };
  if (!res.ok || !data.sub || !data.email) {
    throw new AuthHttpError(
      502,
      data.error || "Conta Google sem e-mail",
    );
  }
  return {
    googleId: data.sub,
    email: data.email.toLowerCase(),
    name: data.name || data.email.split("@")[0],
    avatarUrl: data.picture,
    emailVerified: Boolean(data.email_verified),
  };
}

export async function exchangeGoogleCode(code: string) {
  const accessToken = await exchangeCode(code);
  return fetchGoogleProfile(accessToken);
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

/** Nest AuthService.loginOrRegisterGoogle parity. */
export async function loginOrRegisterGoogle(profile: GoogleProfileUser) {
  const org = await resolveOrganization();
  const email = profile.email.toLowerCase();

  let user = await prisma.user.findFirst({
    where: {
      organizationId: org.id,
      OR: [{ googleId: profile.googleId }, { email }],
    },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email,
        name: profile.name,
        googleId: profile.googleId,
        avatarUrl: profile.avatarUrl,
        authProvider: AuthProvider.GOOGLE,
        platformRole: PlatformRole.BUYER,
        emailVerifiedAt: profile.emailVerified ? new Date() : new Date(),
        cart: { create: {} },
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId: user.googleId ?? profile.googleId,
        avatarUrl: user.avatarUrl ?? profile.avatarUrl,
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        lastLoginAt: new Date(),
        authProvider:
          user.authProvider === AuthProvider.LOCAL
            ? AuthProvider.LOCAL
            : AuthProvider.GOOGLE,
      },
    });
  }

  if (user.totpEnabled) {
    const session = await prisma.authSession.create({
      data: {
        userId: user.id,
        pendingTwoFactor: true,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
    return {
      requiresTwoFactor: true as const,
      sessionToken: session.id,
    };
  }

  return tokenResponse(user, false);
}
