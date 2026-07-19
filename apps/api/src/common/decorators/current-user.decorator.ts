import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';

export type AuthUser = {
  id: string;
  email: string;
  platformRole: PlatformRole;

  role: PlatformRole;
  name: string;
  totpEnabled: boolean;
  emailVerifiedAt: Date | null;
  emailVerified: boolean;
  tfa: boolean;
  canSell: boolean;
  canBuy: boolean;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
