import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { IdempotencyService } from './idempotency.service';
import { RELIABILITY_RULES } from './rules';

/**
 * Applies when handler sets metadata scope via Reflector — used selectively
 * through IdempotencyService in controllers for critical POSTs.
 * This interceptor activates when header Idempotency-Key is present on mutating routes.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotency: IdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { idempotencyScope?: string }>();
    const res = http.getResponse<Response>();

    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return next.handle();
    }

    const keyHeader = RELIABILITY_RULES.idempotency.header;
    const key = String(req.headers[keyHeader] || '').trim();
    if (!key) {
      return next.handle();
    }

    const scope =
      req.idempotencyScope ||
      `${req.method}:${req.path}`.slice(0, 120);
    const hash = this.idempotency.hashRequest(req.body);

    return from(this.idempotency.begin(scope, key, hash)).pipe(
      switchMap((result) => {
        if (result.kind === 'invalid') {
          throw new BadRequestException('Idempotency-Key inválida');
        }
        if (result.kind === 'in_flight') {
          throw new ConflictException(
            'Pedido idempotente em processamento — tente novamente',
          );
        }
        if (result.kind === 'replay') {
          res.status(result.responseCode);
          return of(result.responseBody);
        }

        return next.handle().pipe(
          tap({
            next: (body) => {
              void this.idempotency.complete(scope, key, res.statusCode || 201, body);
            },
            error: () => {
              void this.idempotency.fail(scope, key);
            },
          }),
        );
      }),
    );
  }
}
