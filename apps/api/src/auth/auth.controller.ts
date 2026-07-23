import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import {
  Disable2faDto,
  Enable2faDto,
  LoginDto,
  RegisterDto,
  ResendCodeDto,
  Verify2faDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { clearAuthCookie, setAuthCookie } from './auth-cookie';

/**
 * Nest auth remnant. Local auth + Google OAuth live on services/identity
 * (Phase 13–31). Google Passport removed — use IDENTITY_URL.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private attachSessionCookie(
    res: Response,
    result: unknown,
  ): void {
    if (
      result &&
      typeof result === 'object' &&
      'accessToken' in result &&
      typeof (result as { accessToken: unknown }).accessToken === 'string'
    ) {
      setAuthCookie(
        res,
        this.config,
        (result as { accessToken: string }).accessToken,
      );
    }
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-email')
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyEmail(dto);
    this.attachSessionCookie(res, result);
    return result;
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('resend-code')
  resendCode(@Body() dto: ResendCodeDto) {
    return this.authService.resendCode(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    this.attachSessionCookie(res, result);
    return result;
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-2fa')
  async verify2fa(
    @Body() dto: Verify2faDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verify2fa(dto);
    this.attachSessionCookie(res, result);
    return result;
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    clearAuthCookie(res, this.config);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/setup')
  setup2fa(@CurrentUser() user: AuthUser) {
    return this.authService.setup2fa(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/enable')
  enable2fa(@CurrentUser() user: AuthUser, @Body() dto: Enable2faDto) {
    return this.authService.enable2fa(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  disable2fa(@CurrentUser() user: AuthUser, @Body() dto: Disable2faDto) {
    return this.authService.disable2fa(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }

  /** Cookie/Bearer session probe for cross-app SSO bootstrap. */
  @UseGuards(JwtAuthGuard)
  @Get('session')
  async session(@CurrentUser() user: AuthUser) {
    const me = await this.authService.me(user.id);
    return { authenticated: true, user: me };
  }
}
