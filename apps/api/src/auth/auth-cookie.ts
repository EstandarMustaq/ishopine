import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AUTH_COOKIE_NAME } from '@ishopine/shared';

export function authCookieName(config: ConfigService) {
  return config.get<string>('AUTH_COOKIE_NAME', AUTH_COOKIE_NAME);
}

export function parseCookieHeader(
  header: string | undefined,
  name: string,
): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${name}=`)) continue;
    return decodeURIComponent(trimmed.slice(name.length + 1));
  }
  return null;
}

export function setAuthCookie(
  res: Response,
  config: ConfigService,
  accessToken: string,
) {
  const name = authCookieName(config);
  const isProd = config.get<string>('NODE_ENV') === 'production';
  const domain = config.get<string>('COOKIE_DOMAIN') || undefined;
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000;

  res.cookie(name, accessToken, {
    httpOnly: true,
    secure: isProd || Boolean(domain),
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs,
    ...(domain ? { domain } : {}),
  });
}

export function clearAuthCookie(res: Response, config: ConfigService) {
  const name = authCookieName(config);
  const domain = config.get<string>('COOKIE_DOMAIN') || undefined;
  res.clearCookie(name, {
    httpOnly: true,
    path: '/',
    ...(domain ? { domain } : {}),
  });
}
