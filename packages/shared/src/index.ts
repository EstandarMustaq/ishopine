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
  | "shipping.label.created"
  | "shipping.status.updated";

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

/** Delivery transforms — Cloudinary URL or local Sharp variants (Phase 8). */
export type MediaTransformOptions = {
  width?: number;
  height?: number;
  crop?: "fill" | "fit" | "scale" | "thumb";
  quality?: "auto" | number;
  format?: "auto" | "webp" | "jpg" | "png";
};

/**
 * Map local original URLs to pre-generated Sharp variants:
 * `photo.jpg` → `photo_thumb.webp` / `photo_card.webp`.
 */
export function localVariantUrl(
  url: string,
  variant: "thumb" | "card",
): string {
  if (!url) return url;
  const qIndex = url.indexOf("?");
  const path = qIndex >= 0 ? url.slice(0, qIndex) : url;
  const query = qIndex >= 0 ? url.slice(qIndex) : "";
  const replaced = path.replace(
    /(\.[a-zA-Z0-9]+)$/,
    `_${variant}.webp`,
  );
  return `${replaced}${query}`;
}

/**
 * Absolutize relative media paths behind CDN / public API base.
 * Env: MEDIA_PUBLIC_BASE_URL (e.g. https://cdn.ishopine.com or https://api.ishopine.com).
 */
export function publicMediaUrl(
  url: string,
  baseUrl: string | undefined = process.env.MEDIA_PUBLIC_BASE_URL,
): string {
  if (!url || !baseUrl) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const base = baseUrl.replace(/\/$/, "");
  if (url.startsWith("/")) return `${base}${url}`;
  return `${base}/${url}`;
}

export function buildMediaUrl(
  url: string,
  opts: MediaTransformOptions = {},
): string {
  if (!url) return url;
  // Local / localhost: use Sharp-generated variants by size convention.
  if (url.startsWith("/") || url.startsWith("http://localhost")) {
    const w = opts.width ?? 0;
    const h = opts.height ?? 0;
    let local = url;
    if (w > 0 && w <= 200 && h > 0 && h <= 200) {
      local = localVariantUrl(url, "thumb");
    } else if (w > 0 && w <= 640) {
      local = localVariantUrl(url, "card");
    }
    return publicMediaUrl(local);
  }
  // Cloudinary delivery URL: insert transform segment after /upload/
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) {
    return publicMediaUrl(url);
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
    | "affiliates"
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
    prefix: "/api/affiliate",
    service: "affiliates",
    envKey: "AFFILIATES_URL",
    defaultPort: 4108,
  },
  {
    prefix: "/api/accounts",
    service: "accounts",
    envKey: "ACCOUNTS_URL",
    defaultPort: 4109,
  },
  {
    prefix: "/api/categories",
    service: "catalog",
    envKey: "CATALOG_URL",
    defaultPort: 4110,
  },
  {
    prefix: "/api/seller/categories",
    service: "catalog",
    envKey: "CATALOG_URL",
    defaultPort: 4110,
  },
  {
    prefix: "/api/seller/products",
    service: "catalog",
    envKey: "CATALOG_URL",
    defaultPort: 4110,
  },
  {
    prefix: "/api/admin/products",
    service: "catalog",
    envKey: "CATALOG_URL",
    defaultPort: 4110,
  },
  {
    prefix: "/api/products",
    service: "catalog",
    envKey: "CATALOG_URL",
    defaultPort: 4110,
  },
  {
    prefix: "/uploads",
    service: "media",
    envKey: "MEDIA_URL",
    defaultPort: 4105,
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
