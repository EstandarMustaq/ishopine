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
  "logistics",
  "accounting",
  "comms",
  "coupons",
  "inventory",
  "reviews",
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
  | "MANUAL"
  | "DHL_EXPRESS";

export type ShipmentStatus =
  | "PENDING"
  | "LABEL_CREATED"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";

export type ShippingQuote = {
  method: "FLAT" | "FREE" | "PICKUP" | "CUSTOM" | "EXPRESS";
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
 * Phase 23: MEDIA_CDN_HOST rewrites delivery host (Cloudinary CNAME / edge).
 */
export function publicMediaUrl(
  url: string,
  baseUrl: string | undefined = process.env.MEDIA_PUBLIC_BASE_URL,
): string {
  if (!url) return url;
  let out = url;
  if (!/^https?:\/\//i.test(out)) {
    if (!baseUrl) return out;
    const base = baseUrl.replace(/\/$/, "");
    out = out.startsWith("/") ? `${base}${out}` : `${base}/${out}`;
  }
  return applyCdnHostRewrite(out);
}

/**
 * Rewrite Cloudinary / public media host to a real CDN CNAME when configured.
 * Uses Cloudinary's global edge network (real multi-PoP) — does not invent PoPs.
 *
 * Env:
 * - MEDIA_CDN_HOST — e.g. cdn.ishopine.com (CNAME → Cloudinary private CDN)
 * - CLOUDINARY_CLOUD_NAME — optional; only rewrite matching cloudinary delivery URLs
 */
export function applyCdnHostRewrite(url: string): string {
  const cdnHost = (process.env.MEDIA_CDN_HOST || "").trim().replace(/\/$/, "");
  if (!cdnHost || !url) return url;
  try {
    const u = new URL(url);
    const isCloudinary =
      u.hostname.endsWith("cloudinary.com") ||
      u.hostname.endsWith("cloudinary.com.");
    const isPublicBase = (() => {
      const base = process.env.MEDIA_PUBLIC_BASE_URL;
      if (!base) return false;
      try {
        return new URL(base).hostname === u.hostname;
      } catch {
        return false;
      }
    })();
    if (!isCloudinary && !isPublicBase) return url;
    const host = cdnHost.replace(/^https?:\/\//i, "");
    u.protocol = "https:";
    u.host = host;
    return u.toString();
  } catch {
    return url;
  }
}

/** Phase 23: report configured CDN delivery (ops truth, not a fake PoP map). */
export function mediaCdnStatus() {
  const provider = (process.env.UPLOAD_PROVIDER || "local").toLowerCase();
  const publicBase = process.env.MEDIA_PUBLIC_BASE_URL || null;
  const cdnHost = process.env.MEDIA_CDN_HOST || null;
  const cloudinaryCloud = process.env.CLOUDINARY_CLOUD_NAME || null;
  return {
    provider,
    publicBaseUrl: publicBase,
    cdnHost,
    cloudinaryCloud,
    /** Cloudinary delivery uses their global edge (real multi-PoP CDN). */
    edge:
      provider === "cloudinary" || Boolean(cdnHost)
        ? "cloudinary-global-edge"
        : publicBase
          ? "custom-public-base"
          : "origin-local",
    note:
      "Multi-PoP geography is provided by the CDN vendor (Cloudinary / your CNAME target). iShopine does not invent PoP lists.",
  };
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
  // Cloudinary (or CNAME that keeps /upload/): insert transform segment.
  const canTransform =
    url.includes("/upload/") &&
    (url.includes("cloudinary.com") || Boolean(process.env.MEDIA_CDN_HOST));
  if (!canTransform) {
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
  const transformed = url.replace("/upload/", `/upload/${parts.join(",")}/`);
  return publicMediaUrl(transformed);
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
 * Optional `pathRe` further restricts a prefix (e.g. product reviews).
 */
export type GatewayRoute = {
  prefix: string;
  /** When set, path must also match after the prefix check. */
  pathRe?: RegExp;
  service:
    | FundamentalService
    | "commerce-orchestrator"
    | "media"
    | "developers"
    | "affiliates"
    | "logistics"
    | "accounting"
    | "comms"
    | "coupons"
    | "inventory"
    | "reviews"
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
    prefix: "/api/addresses",
    service: "accounts",
    envKey: "ACCOUNTS_URL",
    defaultPort: 4109,
  },
  {
    prefix: "/api/shops",
    service: "marketplace",
    envKey: "MARKETPLACE_URL",
    defaultPort: 4111,
  },
  {
    prefix: "/api/ads",
    service: "marketplace",
    envKey: "MARKETPLACE_URL",
    defaultPort: 4111,
  },
  {
    prefix: "/api/wishlist",
    service: "marketplace",
    envKey: "MARKETPLACE_URL",
    defaultPort: 4111,
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
  /** Phase 24: reviews before broader /api/products → catalog. */
  {
    prefix: "/api/products/",
    pathRe: /^\/api\/products\/[^/]+\/reviews\/?$/,
    service: "reviews",
    envKey: "REVIEWS_URL",
    defaultPort: 4117,
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
  {
    prefix: "/api/logistics",
    service: "logistics",
    envKey: "LOGISTICS_URL",
    defaultPort: 4112,
  },
  {
    prefix: "/api/accounting",
    service: "accounting",
    envKey: "ACCOUNTING_URL",
    defaultPort: 4113,
  },
  {
    prefix: "/api/notifications",
    service: "comms",
    envKey: "COMMS_URL",
    defaultPort: 4114,
  },
  {
    prefix: "/api/conversations",
    service: "comms",
    envKey: "COMMS_URL",
    defaultPort: 4114,
  },
  {
    prefix: "/api/disputes",
    service: "comms",
    envKey: "COMMS_URL",
    defaultPort: 4114,
  },
  {
    prefix: "/api/coupons",
    service: "coupons",
    envKey: "COUPONS_URL",
    defaultPort: 4115,
  },
  {
    prefix: "/api/inventory",
    service: "inventory",
    envKey: "INVENTORY_URL",
    defaultPort: 4116,
  },
];

export {
  startStranglerProxy,
  type StranglerMode,
  type StranglerOptions,
} from "./strangler";
