import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { randomBytes } from 'crypto';
import { AppModule } from './app.module';

/**
 * Phase 40+: thin Nest edge (health + cron proxy). No /uploads static —
 * media strangler owns uploads. No Prisma boot.
 */
export async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const isProd = config.get<string>('NODE_ENV') === 'production';

  app.use(
    helmet({
      contentSecurityPolicy: isProd
        ? {
            useDefaults: true,
            directives: {
              defaultSrc: ["'self'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              connectSrc: ["'self'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
      hsts: isProd
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
    }),
  );

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const corsOriginRaw = config.get<string>(
    'CORS_ORIGIN',
    'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003',
  );
  const corsOrigin =
    corsOriginRaw === '*'
      ? isProd
        ? false
        : true
      : corsOriginRaw.includes(',')
        ? corsOriginRaw.split(',').map((o) => o.trim()).filter(Boolean)
        : corsOriginRaw;
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'X-Request-Id',
      'x-tenant-id',
    ],
    exposedHeaders: ['X-Request-Id'],
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    const incoming = req.headers['x-request-id'];
    const id =
      (typeof incoming === 'string' && incoming) ||
      `req_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
    res.setHeader('X-Request-Id', id);
    next();
  });

  return app;
}
