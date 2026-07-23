#!/usr/bin/env node
/**
 * Phase 26 — Full cart checkout E2E with remote coupon/inventory/logistics
 * (+ optional accounting post).
 *
 * Prerequisites: Nest :4000 + stranglers with Phase 25/26 remote flags.
 * Loads secrets from apps/api/.env when present.
 *
 * Usage:
 *   node scripts/e2e-phase26-checkout.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const jwt = require(
  path.join(__dirname, "../services/orders/node_modules/jsonwebtoken"),
);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile(path.join(__dirname, "../apps/api/.env"));

const API = (process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000").replace(
  /\/$/,
  "",
);
const ORDERS = (process.env.ORDERS_URL || "http://127.0.0.1:4101").replace(
  /\/$/,
  "",
);
const COUPONS = (process.env.COUPONS_URL || "http://127.0.0.1:4115").replace(
  /\/$/,
  "",
);
const INVENTORY = (
  process.env.INVENTORY_URL || "http://127.0.0.1:4116"
).replace(/\/$/, "");
const LOGISTICS = (
  process.env.LOGISTICS_URL || "http://127.0.0.1:4112"
).replace(/\/$/, "");
const ACCOUNTS = (process.env.ACCOUNTS_URL || "http://127.0.0.1:4109").replace(
  /\/$/,
  "",
);
const ACCOUNTING = (
  process.env.ACCOUNTING_URL || "http://127.0.0.1:4113"
).replace(/\/$/, "");
const ORCHESTRATOR = (
  process.env.ORCHESTRATOR_URL || "http://127.0.0.1:4100"
).replace(/\/$/, "");

const JWT_SECRET = process.env.JWT_SECRET;
const INTERNAL =
  process.env.INTERNAL_SERVICE_SECRET || process.env.CRON_SECRET;

if (!JWT_SECRET) {
  console.error("JWT_SECRET missing");
  process.exit(1);
}
if (!INTERNAL) {
  console.error("INTERNAL_SERVICE_SECRET missing");
  process.exit(1);
}

async function req(base, method, p, { token, body, headers } = {}) {
  const res = await fetch(`${base}${p}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  return { status: res.status, data };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const couponCode = `E2E26${Date.now().toString().slice(-6)}`;
  console.log("[e2e] Phase 26 remote checkout", { couponCode });

  // Health checks
  for (const [name, url] of [
    ["orders", `${ORDERS}/health`],
    ["coupons", `${COUPONS}/health`],
    ["inventory", `${INVENTORY}/health`],
    ["logistics", `${LOGISTICS}/health`],
    ["accounts", `${ACCOUNTS}/health`],
    ["accounting", `${ACCOUNTING}/health`],
    ["orchestrator", `${ORCHESTRATOR}/health`],
  ]) {
    const r = await fetch(url);
    assert(r.ok, `${name} health failed ${r.status}`);
  }

  // Buyer login
  const login = await req(API, "POST", "/api/auth/login", {
    body: { email: "comprador@ishopine.com", password: "IShopine@2026" },
  });
  assert(login.status < 400, `buyer login ${login.status} ${JSON.stringify(login.data)}`);
  assert(login.data.accessToken, "buyer accessToken missing");
  const buyerToken = login.data.accessToken;
  const buyerId = login.data.user.id;

  // Admin JWT with tfa for coupon create + status
  const adminUser = await req(API, "POST", "/api/auth/login", {
    body: { email: "admin@ishopine.com", password: "IShopine@2026" },
  });
  let adminToken;
  if (adminUser.data.accessToken) {
    adminToken = adminUser.data.accessToken;
  } else {
    // 2FA pending — mint staff JWT with tfa:true
    const { PrismaClient } = require(
      path.join(__dirname, "../apps/api/node_modules/@prisma/client"),
    );
    const prisma = new PrismaClient();
    const admin = await prisma.user.findFirst({
      where: { email: "admin@ishopine.com" },
    });
    assert(admin, "admin user missing — run seed");
    adminToken = jwt.sign(
      {
        sub: admin.id,
        email: admin.email,
        platformRole: admin.platformRole,
        emailVerified: true,
        tfa: true,
      },
      JWT_SECRET,
      { expiresIn: "1h" },
    );
    await prisma.$disconnect();
  }

  // Address via accounts owned
  let addresses = await req(ACCOUNTS, "GET", "/api/addresses", {
    token: buyerToken,
  });
  assert(addresses.status === 200, `addresses list ${addresses.status}`);
  let addressId = Array.isArray(addresses.data) && addresses.data[0]?.id;
  if (!addressId) {
    const created = await req(ACCOUNTS, "POST", "/api/addresses", {
      token: buyerToken,
      body: {
        label: "E2E",
        street: "Av Julius Nyerere",
        number: "100",
        district: "KaMpfumo",
        city: "Maputo",
        state: "Maputo Cidade",
        zipCode: "1100",
        isDefault: true,
      },
    });
    assert(created.status === 201, `create address ${created.status}`);
    addressId = created.data.id;
  }

  // Product + cart
  const products = await req(API, "GET", "/api/products?limit=5&status=ACTIVE");
  const list = Array.isArray(products.data)
    ? products.data
    : products.data.items || products.data.data || [];
  assert(list.length > 0, "no products");
  const product = list.find((p) => (p.stock ?? 1) > 0) || list[0];

  await req(ORDERS, "DELETE", "/api/cart", { token: buyerToken }).catch(
    () => {},
  );
  // clear cart items if DELETE not supported
  const cart0 = await req(ORDERS, "GET", "/api/cart", { token: buyerToken });
  if (cart0.data?.items?.length) {
    for (const item of cart0.data.items) {
      await req(ORDERS, "DELETE", `/api/cart/items/${item.productId}`, {
        token: buyerToken,
      });
    }
  }

  const add = await req(ORDERS, "POST", "/api/cart/items", {
    token: buyerToken,
    body: { productId: product.id, quantity: 1 },
  });
  assert(add.status < 400, `add cart ${add.status} ${JSON.stringify(add.data)}`);

  // Coupon
  const coupon = await req(COUPONS, "POST", "/api/coupons", {
    token: adminToken,
    body: {
      code: couponCode,
      type: "FIXED",
      value: 100,
      minSubtotalCents: 0,
      maxUses: 5,
    },
  });
  assert(
    coupon.status === 201,
    `create coupon ${coupon.status} ${JSON.stringify(coupon.data)}`,
  );

  // Checkout on orders owned (remote flags must be set on orders process)
  const checkout = await req(ORDERS, "POST", "/api/orders/checkout", {
    token: buyerToken,
    headers: { "Idempotency-Key": `e2e26-${Date.now()}` },
    body: {
      addressId,
      paymentMethod: "PIX",
      couponCode,
      notes: "phase26 e2e remote",
    },
  });
  assert(
    checkout.status === 201 || checkout.status === 200,
    `checkout ${checkout.status} ${JSON.stringify(checkout.data)}`,
  );
  const order = checkout.data.orders?.[0];
  assert(order?.id, "order id missing");
  console.log("[e2e] order", order.orderNumber, order.id);

  // Verify RESERVE movement via internal-ish list (staff)
  const movements = await req(
    INVENTORY,
    "GET",
    `/api/inventory/movements?productId=${product.id}`,
    { token: adminToken },
  );
  assert(movements.status === 200, `movements ${movements.status}`);
  const reserve = (movements.data || []).find(
    (m) => m.reference === order.id && m.type === "RESERVE",
  );
  assert(reserve, "RESERVE movement missing — is INVENTORY_RESERVE_REMOTE on?");

  // Verify coupon redemption via second redeem idempotent
  const redeemAgain = await req(COUPONS, "POST", "/api/coupons/internal/redeem", {
    headers: { Authorization: `Bearer ${INTERNAL}` },
    body: {
      code: couponCode,
      orderId: order.id,
      amountCents: order.discountCents || 100,
      subtotalCents: order.subtotalCents,
    },
  });
  assert(redeemAgain.status === 200, `redeem ${redeemAgain.status}`);
  assert(
    redeemAgain.data.alreadyRedeemed === true,
    "expected alreadyRedeemed after checkout redeem",
  );

  // Confirm → fulfill + accounting
  const confirmed = await req(ORDERS, "PATCH", `/api/orders/${order.id}/status`, {
    token: adminToken,
    body: { status: "CONFIRMED" },
  });
  assert(
    confirmed.status === 200,
    `confirm ${confirmed.status} ${JSON.stringify(confirmed.data)}`,
  );

  const movements2 = await req(
    INVENTORY,
    "GET",
    `/api/inventory/movements?productId=${product.id}`,
    { token: adminToken },
  );
  const out = (movements2.data || []).find(
    (m) => m.reference === order.id && m.type === "OUT",
  );
  assert(out, "OUT movement missing after CONFIRMED");

  // SHIPPED → remote label
  const shipped = await req(ORDERS, "PATCH", `/api/orders/${order.id}/status`, {
    token: adminToken,
    body: { status: "SHIPPED" },
  });
  assert(
    shipped.status === 200,
    `ship ${shipped.status} ${JSON.stringify(shipped.data)}`,
  );

  const label = await req(
    LOGISTICS,
    "POST",
    "/api/logistics/internal/create-label",
    {
      headers: { Authorization: `Bearer ${INTERNAL}` },
      body: { orderId: order.id },
    },
  );
  // may already be labeled — 200 either way
  assert(label.status === 200, `label ${label.status} ${JSON.stringify(label.data)}`);
  assert(label.data.trackingCode || label.data.id, "label payload incomplete");

  // Correios still unavailable
  const partners = await req(LOGISTICS, "GET", "/api/logistics/partners");
  const correios = (partners.data.live || []).find((p) => p.code === "CORREIOS_MZ");
  assert(correios?.mode === "unavailable", "Correios must stay unavailable");
  assert(correios?.configured === false, "Correios configured must be false");

  // Orchestrator health shows compose bases
  const orch = await req(ORCHESTRATOR, "GET", "/health");
  assert(orch.data.ordersBase, "orchestrator ordersBase");
  assert(orch.data.paymentsBase, "orchestrator paymentsBase");

  console.log("[e2e] OK", {
    orderId: order.id,
    orderNumber: order.orderNumber,
    couponCode,
    reserveId: reserve.id,
    outId: out.id,
    trackingCode: label.data.trackingCode,
    buyerId,
  });
}

main().catch((err) => {
  console.error("[e2e] FAIL", err.message || err);
  process.exit(1);
});
