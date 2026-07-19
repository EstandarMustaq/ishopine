import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformRole } from '@prisma/client';
import { AuthUser } from '../decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Protects painel/dashboard routes.
 * - If totpEnabled: JWT must include tfa=true
 * - PLATFORM_ADMIN / PLATFORM_OPERATOR / sellers: 2FA expected after login
 * - Seed/dev: users without totpEnabled may access when NODE_ENV !== production
 *   or PlatformSettings.requireSeller2fa is false
 */
@Injectable()
export class TwoFactorGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user: AuthUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Autenticação necessária');
    }

    if (user.totpEnabled) {
      if (!user.tfa) {
        throw new ForbiddenException(
          'Autenticação de dois fatores necessária. Complete o login 2FA.',
        );
      }
      return true;
    }

    const elevated =
      user.platformRole === PlatformRole.PLATFORM_ADMIN ||
      user.platformRole === PlatformRole.PLATFORM_OPERATOR ||
      user.canSell;

    let isSellerMember = user.canSell;
    if (!isSellerMember) {
      const membership = await this.prisma.shopMember.findFirst({
        where: { userId: user.id, isActive: true },
        select: { id: true },
      });
      isSellerMember = Boolean(membership);
    }

    if (!elevated && !isSellerMember) {
      return true;
    }

    const orgSlug = this.config.get<string>('PLATFORM_ORG_SLUG', 'nkateko');
    const settings = await this.prisma.platformSettings.findFirst({
      where: { organization: { slug: orgSlug } },
    });

    const require2fa = settings?.requireSeller2fa ?? true;
    const isProd = this.config.get<string>('NODE_ENV') === 'production';

    if (require2fa && isProd) {
      throw new ForbiddenException(
        'Configure a autenticação de dois fatores antes de acessar o painel.',
      );
    }

    return true;
  }
}
