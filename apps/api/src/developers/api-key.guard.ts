import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { DevelopersService } from './developers.service';

export type ApiKeyContext = {
  tenantId: string;
  accountId: string;
  shopId: string | null;
  apiKeyId: string;
};

export const CurrentApiKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ApiKeyContext => {
    const request = ctx.switchToHttp().getRequest<{ apiKey?: ApiKeyContext }>();
    if (!request.apiKey) {
      throw new UnauthorizedException('API key context em falta');
    }
    return request.apiKey;
  },
);

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly developers: DevelopersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      apiKey?: ApiKeyContext;
    }>();
    const auth = request.headers.authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(auth);
    if (!match) {
      throw new UnauthorizedException('Bearer API key necessária');
    }
    request.apiKey = await this.developers.authenticateApiKey(match[1].trim());
    return true;
  }
}
