import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { PlatformRole } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { authCookieName, parseCookieHeader } from './auth-cookie';

export type JwtPayload = {
  sub: string;
  email: string;
  platformRole: PlatformRole;
  emailVerified: boolean;
  tfa: boolean;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const cookieName = authCookieName(config);
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) =>
          parseCookieHeader(req.headers?.cookie, cookieName),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        platformRole: true,
        name: true,
        isActive: true,
        totpEnabled: true,
        emailVerifiedAt: true,
        canSell: true,
        canBuy: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuário inválido ou inativo');
    }

    return {
      id: user.id,
      email: user.email,
      platformRole: user.platformRole,
      role: user.platformRole,
      name: user.name,
      totpEnabled: user.totpEnabled,
      emailVerifiedAt: user.emailVerifiedAt,
      emailVerified: Boolean(user.emailVerifiedAt),
      tfa: Boolean(payload.tfa),
      canSell: user.canSell,
      canBuy: user.canBuy,
    };
  }
}
