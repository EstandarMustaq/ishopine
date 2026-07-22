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
  shopId?: string | null;
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

/** Later modules (not day-1 services). */
export const PLATFORM_MODULES = [
  "pricing",
  "media",
  "feature-flags",
  "subscriptions",
  "discovery",
  "commerce-orchestrator",
] as const;

export type PlatformModule = (typeof PLATFORM_MODULES)[number];

/* ── Commerce / Phase 3 contracts ─────────────────────────────── */

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export type PaysuiteMethod = "mpesa" | "emola" | "credit_card";

export type CheckoutCommand = {
  addressId?: string;
  /** Order-level method (MPESA / EMOLA / CREDIT_CARD / …). */
  paymentMethod?: string;
  notes?: string;
  couponCode?: string;
  affiliateCode?: string;
  /** PaySuite rail used after orders are created. */
  paysuiteMethod: PaysuiteMethod;
  msisdn?: string;
};

export type CheckoutOrderSummary = {
  id: string;
  orderNumber: string;
  totalCents: number;
  sellerShopId: string;
};

export type CheckoutSagaResult = {
  sagaId: string;
  steps: CommerceSagaStep[];
  orders: CheckoutOrderSummary[];
  orderCount: number;
  totalCents: number;
  payment: {
    paymentId: string;
    reference?: string;
    status?: string;
    checkoutUrl?: string;
    url?: string;
    simulated?: boolean;
    method?: string;
    amountCents?: number;
    currency?: string;
    message?: string;
  };
};

export type CommerceSagaStepName =
  | "validate"
  | "create_orders"
  | "create_payment"
  | "done"
  | "failed";

export type CommerceSagaStep = {
  name: CommerceSagaStepName;
  status: "pending" | "ok" | "error";
  at: string;
  detail?: string;
};

export type OutboxEventType =
  | "billing.payment.paid"
  | "billing.payment.failed"
  | "order.created"
  | "order.confirmed"
  | "commerce.checkout.completed"
  | "commerce.checkout.failed"
  | "affiliate.reward.approved"
  | "affiliate.reward.paid";

export const IDEMPOTENCY_SCOPES = {
  ordersCheckout: "orders:checkout",
  paysuiteCheckout: "billing:paysuite:checkout",
  commerceCheckout: "commerce:checkout",
} as const;

/**
 * Gateway strangler route table.
 * `null` destination = fall through to monolith upstream.
 */
export type GatewayRoute = {
  prefix: string;
  service:
    | FundamentalService
    | "commerce-orchestrator"
    | "monolith";
  /** Env var holding the service base URL. */
  envKey?: string;
  defaultPort?: number;
};

export const GATEWAY_ROUTES: GatewayRoute[] = [
  {
    prefix: "/api/commerce",
    service: "commerce-orchestrator",
    envKey: "ORCHESTRATOR_URL",
    defaultPort: 4100,
  },
  {
    prefix: "/api/orders",
    service: "orders",
    envKey: "ORDERS_URL",
    defaultPort: 4101,
  },
  {
    prefix: "/api/cart",
    service: "orders",
    envKey: "ORDERS_URL",
    defaultPort: 4101,
  },
  {
    prefix: "/api/billing/paysuite",
    service: "payments",
    envKey: "PAYMENTS_URL",
    defaultPort: 4102,
  },
];
