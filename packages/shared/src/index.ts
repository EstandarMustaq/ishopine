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
  "developers",
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
  | "affiliate.reward.paid"
  | "wallet.credited"
  | "subscription.changed"
  | "platform.invoice.generated"
  | "merchant.webhook.delivered"
  | "shipping.quote.requested"
  | "shipping.label.created";

/** Phase 6 SSO cookie (HttpOnly). Shared parent domain via COOKIE_DOMAIN. */
export const AUTH_COOKIE_NAME = "ishopine_session";

export type ShippingQuoteRequest = {
  tenantId?: string;
  shopId?: string;
  destinationProvince: string;
  destinationDistrict: string;
  weightKg?: number;
  subtotalCents: number;
};

export type CarrierCode =
  | "FLAT_RATE"
  | "FREE_THRESHOLD"
  | "STORE_PICKUP"
  | "CORREIOS_MZ"
  | "MANUAL";

export type ShipmentStatus =
  | "PENDING"
  | "LABEL_CREATED"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";

export type ShippingQuote = {
  method: "FLAT" | "FREE" | "PICKUP" | "CUSTOM";
  carrierCode?: CarrierCode | string;
  label: string;
  amountCents: number;
  etaDaysMin?: number;
  etaDaysMax?: number;
};

export type ShipmentSummary = {
  id: string;
  orderId: string;
  carrierCode: CarrierCode | string;
  method: string;
  status: ShipmentStatus | string;
  trackingCode?: string | null;
  amountCents: number;
};

/** Cloudinary-style delivery transforms (Phase 7 CDN stub). */
export type MediaTransformOptions = {
  width?: number;
  height?: number;
  crop?: "fill" | "fit" | "scale" | "thumb";
  quality?: "auto" | number;
  format?: "auto" | "webp" | "jpg" | "png";
};

export function buildMediaUrl(
  url: string,
  opts: MediaTransformOptions = {},
): string {
  if (!url) return url;
  // Local paths: return as-is (no CDN).
  if (url.startsWith("/") || url.startsWith("http://localhost")) {
    return url;
  }
  // Cloudinary delivery URL: insert transform segment after /upload/
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) {
    return url;
  }
  const parts: string[] = [];
  if (opts.width) parts.push(`w_${opts.width}`);
  if (opts.height) parts.push(`h_${opts.height}`);
  if (opts.crop) parts.push(`c_${opts.crop}`);
  if (opts.quality != null) parts.push(`q_${opts.quality}`);
  if (opts.format) parts.push(`f_${opts.format}`);
  if (parts.length === 0) {
    parts.push("q_auto", "f_auto");
  }
  return url.replace("/upload/", `/upload/${parts.join(",")}/`);
}

export type WalletOwnerType = "ACCOUNT" | "TENANT" | "PLATFORM";
export type LedgerEntryType =
  | "CREDIT"
  | "DEBIT"
  | "HOLD"
  | "RELEASE"
  | "ADJUSTMENT";
export type PricingPlanCode = "FREE" | "STARTER" | "BUSINESS" | "ENTERPRISE";
export type SubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELLED";
export type UsageMetric = "ORDERS" | "PRODUCTS" | "CHECKOUTS" | "API_CALLS";

export type WalletSummary = {
  id: string;
  key: string;
  ownerType: WalletOwnerType;
  currency: string;
  availableCents: number;
  heldCents: number;
};

export type PricingPlanSummary = {
  code: PricingPlanCode;
  name: string;
  monthlyPriceCents: number;
  includedOrders: number | null;
  overageOrderCents: number;
  commissionBps: number | null;
};

export type FeatureFlagEvaluation = {
  key: string;
  enabled: boolean;
  source: "global" | "tenant" | "plan" | "missing";
};

export type MerchantApiKeySummary = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt?: string | null;
  createdAt: string;
};

export const IDEMPOTENCY_SCOPES = {
  ordersCheckout: "orders:checkout",
  paysuiteCheckout: "billing:paysuite:checkout",
  commerceCheckout: "commerce:checkout",
} as const;

/**
 * Gateway strangler route table.
 * More specific prefixes must appear before broader ones.
 */
export type GatewayRoute = {
  prefix: string;
  service:
    | FundamentalService
    | "commerce-orchestrator"
    | "media"
    | "developers"
    | "monolith";
  /** Env var holding the service base URL. */
  envKey?: string;
  defaultPort?: number;
};

export const GATEWAY_ROUTES: GatewayRoute[] = [
  {
    prefix: "/api/auth",
    service: "identity",
    envKey: "IDENTITY_URL",
    defaultPort: 4107,
  },
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
  {
    prefix: "/api/wallet",
    service: "wallet",
    envKey: "WALLET_URL",
    defaultPort: 4103,
  },
  {
    prefix: "/api/pricing",
    service: "billing",
    envKey: "BILLING_URL",
    defaultPort: 4104,
  },
  {
    prefix: "/api/subscriptions",
    service: "billing",
    envKey: "BILLING_URL",
    defaultPort: 4104,
  },
  {
    prefix: "/api/billing",
    service: "billing",
    envKey: "BILLING_URL",
    defaultPort: 4104,
  },
  {
    prefix: "/api/media",
    service: "media",
    envKey: "MEDIA_URL",
    defaultPort: 4105,
  },
  {
    prefix: "/api/uploads",
    service: "media",
    envKey: "MEDIA_URL",
    defaultPort: 4105,
  },
  {
    prefix: "/api/developers",
    service: "developers",
    envKey: "DEVELOPERS_URL",
    defaultPort: 4106,
  },
  {
    prefix: "/api/v1",
    service: "developers",
    envKey: "DEVELOPERS_URL",
    defaultPort: 4106,
  },
  {
    prefix: "/api/feature-flags",
    service: "developers",
    envKey: "DEVELOPERS_URL",
    defaultPort: 4106,
  },
];

export {
  startStranglerProxy,
  type StranglerMode,
  type StranglerOptions,
} from "./strangler";
