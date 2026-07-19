import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';

export type GoogleProfileUser = {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  emailVerified: boolean;
};

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    const clientID = config.get<string>('GOOGLE_CLIENT_ID') || 'missing';
    const clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET') || 'missing';
    const callbackURL =
      config.get<string>('GOOGLE_CALLBACK_URL') ||
      'http://localhost:4000/api/auth/google/callback';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('Conta Google sem e-mail'), undefined);
      return;
    }

    const user: GoogleProfileUser = {
      googleId: profile.id,
      email: email.toLowerCase(),
      name: profile.displayName || email.split('@')[0],
      avatarUrl: profile.photos?.[0]?.value,
      emailVerified: Boolean(profile.emails?.[0]?.verified),
    };

    done(null, user);
  }
}
