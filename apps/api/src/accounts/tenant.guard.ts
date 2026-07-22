import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformRole, TenantType } from '@prisma/client';
import { AccountsService } from './accounts.service';
import { TENANT_HEADER } from './tenant.constants';

export const TENANT_TYPES_KEY = 'tenant_types';
export const RequireTenantTypes = (...types: TenantType[]) =>
  SetMetadata(TENANT_TYPES_KEY, types);

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly accounts: AccountsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: { id: string; platformRole?: PlatformRole };
      headers: Record<string, string | string[] | undefined>;
      tenant?: Awaited<ReturnType<AccountsService['resolveTenantAccess']>> | null;
    }>();

    const allowed = this.reflector.getAllAndOverride<TenantType[] | undefined>(
      TENANT_TYPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!request.user?.id) {
      throw new ForbiddenException('Não autenticado');
    }

    const raw = request.headers[TENANT_HEADER];
    const tenantId = Array.isArray(raw) ? raw[0] : raw;

    // Platform staff may call seller APIs without a tenant (ops tooling).
    const isStaff =
      request.user.platformRole === PlatformRole.PLATFORM_ADMIN ||
      request.user.platformRole === PlatformRole.PLATFORM_OPERATOR;

    if (!tenantId) {
      if (isStaff) {
        request.tenant = null;
        return true;
      }
      throw new ForbiddenException(
        `Cabeçalho ${TENANT_HEADER} é obrigatório neste recurso`,
      );
    }

    const account = await this.accounts.ensureAccountForUser(request.user.id);
    const tenant = await this.accounts.resolveTenantAccess(
      account.id,
      tenantId,
    );

    if (allowed?.length && !allowed.includes(tenant.tenantType)) {
      throw new ForbiddenException(
        `Este recurso só aceita tenant: ${allowed.join(', ')}`,
      );
    }

    request.tenant = tenant;
    return true;
  }
}
