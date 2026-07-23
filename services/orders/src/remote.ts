/**
 * Phase 25: optional remote side-effects for checkout/status.
 * Fail-closed when flag + URL + secret are set; otherwise callers keep inline.
 */
const internalSecret =
  process.env.INTERNAL_SERVICE_SECRET || process.env.CRON_SECRET || "";

function remoteOn(flag: string, url?: string) {
  return (
    process.env[flag] !== "0" &&
    Boolean(url) &&
    Boolean(internalSecret)
  );
}

async function postJson(
  base: string,
  path: string,
  body: unknown,
): Promise<unknown> {
  const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${internalSecret}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { message: text };
    }
  }
  if (!res.ok) {
    const msg =
      parsed &&
      typeof parsed === "object" &&
      "message" in parsed &&
      typeof (parsed as { message: unknown }).message === "string"
        ? (parsed as { message: string }).message
        : text.slice(0, 300);
    const err = new Error(msg);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return parsed;
}

export function couponRedeemRemoteEnabled() {
  return remoteOn("COUPON_REDEEM_REMOTE", process.env.COUPONS_URL);
}

export function inventoryReserveRemoteEnabled() {
  return remoteOn("INVENTORY_RESERVE_REMOTE", process.env.INVENTORY_URL);
}

export function logisticsLabelRemoteEnabled() {
  return remoteOn("LOGISTICS_LABEL_REMOTE", process.env.LOGISTICS_URL);
}

export async function remoteRedeemCoupon(input: {
  code: string;
  orderId: string;
  amountCents: number;
  subtotalCents: number;
}) {
  return postJson(process.env.COUPONS_URL!, "/api/coupons/internal/redeem", input);
}

export async function remoteReserveStock(input: {
  orderId: string;
  orderNumber: string;
  items: Array<{ productId: string; quantity: number }>;
  operatorId?: string;
}) {
  return postJson(
    process.env.INVENTORY_URL!,
    "/api/inventory/internal/reserve",
    input,
  );
}

export async function remoteReleaseStock(input: {
  orderId: string;
  orderNumber: string;
  items: Array<{ productId: string; quantity: number }>;
  operatorId?: string;
}) {
  return postJson(
    process.env.INVENTORY_URL!,
    "/api/inventory/internal/release",
    input,
  );
}

export async function remoteFulfillStock(input: {
  orderId: string;
  orderNumber: string;
  items: Array<{ productId: string; quantity: number }>;
  operatorId?: string;
}) {
  return postJson(
    process.env.INVENTORY_URL!,
    "/api/inventory/internal/fulfill",
    input,
  );
}

export async function remoteCreateLabel(orderId: string) {
  return postJson(
    process.env.LOGISTICS_URL!,
    "/api/logistics/internal/create-label",
    { orderId },
  );
}

export async function remoteMarkDelivered(orderId: string) {
  return postJson(
    process.env.LOGISTICS_URL!,
    "/api/logistics/internal/mark-delivered",
    { orderId },
  );
}
