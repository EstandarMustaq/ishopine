/** Tenant / account contracts shared across gateway + services (strangler). */

export type TenantType = "PARTICULAR" | "STORE";

export type TenantMemberRole =
  | "OWNER"
  | "ADMIN"
  | "MANAGER"
  | "STAFF"
  | "VIEWER";

export type PlatformStaffRole = "OPS" | "MODERATOR" | "ENGINEER" | "FINANCE";

export type TenantContext = {
  tenantId: string;
  tenantType: TenantType;
  tenantSlug: string;
  membershipRole: TenantMemberRole;
};

export type AccountContext = {
  accountId: string;
  userId: string;
  email: string;
  name: string;
  /** Active seller context — required for seller APIs. */
  tenant?: TenantContext | null;
  /** Present only for iShopine backoffice staff. */
  platformStaffRole?: PlatformStaffRole | null;
};

export const TENANT_HEADER = "x-tenant-id";

export const FUNDAMENTAL_SERVICES = [
  "identity",
  "accounts",
  "marketplace",
  "catalog",
  "orders",
  "payments",
  "wallet",
  "billing",
] as const;

export type FundamentalService = (typeof FUNDAMENTAL_SERVICES)[number];
