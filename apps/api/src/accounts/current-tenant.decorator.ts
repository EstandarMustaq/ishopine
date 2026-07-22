import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { TenantMemberRole, TenantType } from '@prisma/client';

export type RequestTenant = {
  tenantId: string;
  tenantType: TenantType;
  tenantSlug: string;
  membershipRole: TenantMemberRole;
  shopId: string | null;
};

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestTenant | null => {
    const request = ctx.switchToHttp().getRequest<{
      tenant?: RequestTenant | null;
    }>();
    return request.tenant ?? null;
  },
);
