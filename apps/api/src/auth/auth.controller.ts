import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
// ServiceUnavailableException kept for google/callback guard path
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
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
import type { GoogleProfileUser } from './google.strategy';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private googleConfigured() {
    return Boolean(
      this.config.get<string>('GOOGLE_CLIENT_ID') &&
        this.config.get<string>('GOOGLE_CLIENT_SECRET') &&
        this.config.get<string>('GOOGLE_CALLBACK_URL'),
    );
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('resend-code')
  resendCode(@Body() dto: ResendCodeDto) {
    return this.authService.resendCode(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-2fa')
  verify2fa(@Body() dto: Verify2faDto) {
    return this.authService.verify2fa(dto);
  }

  @Get('google')
  googleEntry(@Res() res: Response) {
    if (!this.googleConfigured()) {
      return res.status(503).json({
        statusCode: 503,
        message:
          'Login com Google não configurado. Defina GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_CALLBACK_URL.',
        error: 'Service Unavailable',
      });
    }
    return res.redirect('/api/auth/google/start');
  }

  @Get('google/start')
  @UseGuards(AuthGuard('google'))
  googleStart() {
    // Passport redirects to Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    if (!this.googleConfigured()) {
      throw new ServiceUnavailableException(
        'Login com Google não configurado.',
      );
    }

    const profile = req.user as GoogleProfileUser;
    const result = await this.authService.loginOrRegisterGoogle(profile);
    const webUrl = this.config.get<string>('WEB_URL', 'http://localhost:3000');

    if ('requiresTwoFactor' in result && result.requiresTwoFactor) {
      const url = new URL('/auth/2fa', webUrl);
      url.searchParams.set('sessionToken', result.sessionToken);
      return res.redirect(url.toString());
    }

    if ('accessToken' in result) {
      const url = new URL('/auth/callback', webUrl);
      url.searchParams.set('accessToken', result.accessToken);
      return res.redirect(url.toString());
    }

    return res.redirect(`${webUrl}/auth/login?error=google`);
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
}
