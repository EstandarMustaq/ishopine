import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  AuthProvider,
  PlatformRole,
  VerificationPurpose,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt } from 'crypto';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import type { GoogleProfileUser } from './google.strategy';
import {
  Disable2faDto,
  Enable2faDto,
  LoginDto,
  RegisterDto,
  ResendCodeDto,
  Verify2faDto,
  VerifyEmailDto,
} from './dto/auth.dto';

const CODE_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 10 * 60 * 1000;
const BACKUP_CODE_COUNT = 8;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private async resolveOrganization() {
    const slug = this.config.get<string>('PLATFORM_ORG_SLUG', 'ishopine');
    let org = await this.prisma.organization.findUnique({ where: { slug } });
    if (!org) {
      org = await this.prisma.organization.create({
        data: {
          name: 'iShopine',
          slug,
          legalName: 'Nkateko Investment and Service',
          supportEmail: 'contato@ishopine.com',
          settings: {
            create: {
              marketplaceName: 'iShopine',
              tagline: 'Mercado aberto — compre e venda com confiança',
            },
          },
        },
      });
    }
    return org;
  }

  private async issueVerificationCode(
    email: string,
    purpose: VerificationPurpose,
    userId?: string,
  ) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = this.hash(code);

    await this.prisma.emailVerificationCode.updateMany({
      where: {
        email,
        purpose,
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });

    await this.prisma.emailVerificationCode.create({
      data: {
        email,
        userId,
        codeHash,
        purpose,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    await this.mail.sendVerificationCode(
      email,
      code,
      purpose === VerificationPurpose.LOGIN_OTP
        ? 'login'
        : 'verificação de e-mail',
    );

    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    return {
      code,
      devCode: !isProd && !this.mail.isConfigured() ? code : undefined,
    };
  }

  private publicUser(user: {
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
    };
  }

  private tokenResponse(
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
    const accessToken = this.jwt.sign({
      sub: user.id,
      email: user.email,
      platformRole: user.platformRole,
      emailVerified: Boolean(user.emailVerifiedAt),
      tfa,
    });

    return {
      accessToken,
      user: this.publicUser(user),
    };
  }

  async register(dto: RegisterDto) {
    const org = await this.resolveOrganization();
    const email = dto.email.toLowerCase();

    const existing = await this.prisma.user.findUnique({
      where: {
        organizationId_email: { organizationId: org.id, email },
      },
    });

    if (existing) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        organizationId: org.id,
        email,
        passwordHash,
        name: dto.name,
        phone: dto.phone,
        platformRole: PlatformRole.BUYER,
        authProvider: AuthProvider.LOCAL,
        cart: { create: {} },
      },
    });

    const { devCode } = await this.issueVerificationCode(
      email,
      VerificationPurpose.EMAIL_VERIFY,
      user.id,
    );

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'auth.register',
        entityType: 'User',
        entityId: user.id,
      },
    });

    return {
      message:
        'Conta criada. Verifique seu e-mail com o código de 6 dígitos antes de acessar.',
      email,
      requiresEmailVerification: true,
      ...(devCode ? { devCode } : {}),
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const org = await this.resolveOrganization();
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: {
        organizationId_email: { organizationId: org.id, email },
      },
    });

    if (!user) {
      throw new BadRequestException('Usuário não encontrado');
    }

    if (user.emailVerifiedAt) {
      return this.tokenResponse(user, !user.totpEnabled);
    }

    await this.consumeCode(
      email,
      VerificationPurpose.EMAIL_VERIFY,
      dto.code,
      user.id,
    );

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });

    return this.tokenResponse(updated, !updated.totpEnabled);
  }

  async resendCode(dto: ResendCodeDto) {
    const org = await this.resolveOrganization();
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: {
        organizationId_email: { organizationId: org.id, email },
      },
    });

    if (!user) {
      // Avoid account enumeration
      return { message: 'Se o e-mail existir, um novo código foi enviado.' };
    }

    if (user.emailVerifiedAt) {
      return { message: 'E-mail já verificado.' };
    }

    const { devCode } = await this.issueVerificationCode(
      email,
      VerificationPurpose.EMAIL_VERIFY,
      user.id,
    );

    return {
      message: 'Novo código enviado.',
      ...(devCode ? { devCode } : {}),
    };
  }

  private async consumeCode(
    email: string,
    purpose: VerificationPurpose,
    code: string,
    userId?: string,
  ) {
    const record = await this.prisma.emailVerificationCode.findFirst({
      where: {
        email,
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
        ...(userId ? { userId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException('Código inválido ou expirado');
    }

    if (record.attempts >= 5) {
      throw new BadRequestException(
        'Muitas tentativas. Solicite um novo código.',
      );
    }

    const valid = record.codeHash === this.hash(code);
    await this.prisma.emailVerificationCode.update({
      where: { id: record.id },
      data: {
        attempts: { increment: 1 },
        ...(valid ? { consumedAt: new Date() } : {}),
      },
    });

    if (!valid) {
      throw new BadRequestException('Código inválido ou expirado');
    }
  }

  async login(dto: LoginDto) {
    const org = await this.resolveOrganization();
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: {
        organizationId_email: { organizationId: org.id, email },
      },
    });

    if (!user || !user.isActive || !user.passwordHash) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!user.emailVerifiedAt) {
      const { devCode } = await this.issueVerificationCode(
        email,
        VerificationPurpose.EMAIL_VERIFY,
        user.id,
      );
      return {
        requiresEmailVerification: true,
        email,
        message: 'Verifique seu e-mail antes de continuar.',
        ...(devCode ? { devCode } : {}),
      };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    if (user.totpEnabled) {
      const session = await this.prisma.authSession.create({
        data: {
          userId: user.id,
          pendingTwoFactor: true,
          expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        },
      });

      return {
        requiresTwoFactor: true,
        sessionToken: session.id,
        message: 'Informe o código do autenticador.',
      };
    }

    return this.tokenResponse(user, false);
  }

  async verify2fa(dto: Verify2faDto) {
    const session = await this.prisma.authSession.findUnique({
      where: { id: dto.sessionToken },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt ||
      !session.pendingTwoFactor ||
      session.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Sessão 2FA inválida ou expirada');
    }

    const user = session.user;
    if (!user.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('2FA não está ativo nesta conta');
    }

    const totpOk = this.verifyTotp(user.totpSecret, dto.code);
    const backupOk =
      !totpOk &&
      user.backupCodesHash.some((hash) => hash === this.hash(dto.code));

    if (!totpOk && !backupOk) {
      throw new UnauthorizedException('Código 2FA inválido');
    }

    if (backupOk) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          backupCodesHash: user.backupCodesHash.filter(
            (hash) => hash !== this.hash(dto.code),
          ),
        },
      });
    }

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { pendingTwoFactor: false, revokedAt: new Date() },
    });

    return this.tokenResponse(user, true);
  }

  private verifyTotp(secret: string, token: string) {
    const result = verifySync({ secret, token });
    return Boolean(result.valid);
  }

  async setup2fa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }

    const secret = generateSecret();
    const issuer = 'Nkateko';
    const uri = generateURI({
      issuer,
      label: user.email,
      secret,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(uri);

    await this.prisma.user.update({
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
        'Escaneie o QR no autenticador e confirme com um código em /auth/2fa/enable',
    };
  }

  async enable2fa(userId: string, dto: Enable2faDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecret) {
      throw new BadRequestException('Inicie o setup 2FA primeiro');
    }

    if (!this.verifyTotp(user.totpSecret, dto.code)) {
      throw new BadRequestException('Código inválido');
    }

    const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
      randomBytes(4).toString('hex'),
    );
    const backupCodesHash = backupCodes.map((code) => this.hash(code));

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpEnabled: true,
        totpVerifiedAt: new Date(),
        backupCodesHash,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'auth.2fa.enable',
        entityType: 'User',
        entityId: userId,
      },
    });

    return {
      enabled: true,
      backupCodes,
      message:
        '2FA ativado. Guarde os códigos de backup — eles não serão mostrados novamente.',
      accessToken: this.jwt.sign({
        sub: user.id,
        email: user.email,
        platformRole: user.platformRole,
        emailVerified: Boolean(user.emailVerifiedAt),
        tfa: true,
      }),
    };
  }

  async disable2fa(userId: string, dto: Disable2faDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('2FA não está ativo');
    }

    const totpOk = this.verifyTotp(user.totpSecret, dto.code);
    const backupOk = user.backupCodesHash.includes(this.hash(dto.code));
    if (!totpOk && !backupOk) {
      throw new UnauthorizedException('Código inválido');
    }

    await this.prisma.user.update({
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

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
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
          orderBy: { isDefault: 'desc' },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      ...user,
      role: user.platformRole,
    };
  }

  async loginOrRegisterGoogle(profile: GoogleProfileUser) {
    const org = await this.resolveOrganization();
    const email = profile.email.toLowerCase();

    let user = await this.prisma.user.findFirst({
      where: {
        organizationId: org.id,
        OR: [{ googleId: profile.googleId }, { email }],
      },
    });

    if (!user) {
      user = await this.prisma.user.create({
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
      user = await this.prisma.user.update({
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
      const session = await this.prisma.authSession.create({
        data: {
          userId: user.id,
          pendingTwoFactor: true,
          expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        },
      });
      return {
        requiresTwoFactor: true,
        sessionToken: session.id,
      };
    }

    return this.tokenResponse(user, false);
  }
}
