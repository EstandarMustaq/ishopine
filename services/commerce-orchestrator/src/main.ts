import http from "node:http";
import { randomBytes } from "node:crypto";
import type {
  CheckoutCommand,
  CheckoutSagaResult,
  CommerceSagaStep,
  PaysuiteMethod,
} from "@ishopine/shared";

const port = Number(process.env.PORT || 4100);
const upstream = (
  process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000"
).replace(/\/$/, "");

type Json = Record<string, unknown>;

function step(
  name: CommerceSagaStep["name"],
  status: CommerceSagaStep["status"],
  detail?: string,
): CommerceSagaStep {
  return { name, status, at: new Date().toISOString(), detail };
}

async function readJson(req: http.IncomingMessage): Promise<Json> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw) as Json;
}

async function upstreamFetch(
  path: string,
  init: {
    method?: string;
    authorization?: string;
    body?: unknown;
    idempotencyKey?: string;
  },
): Promise<{ status: number; body: Json }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Strangler-Service": "commerce-orchestrator",
  };
  if (init.authorization) headers.Authorization = init.authorization;
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;

  const res = await fetch(`${upstream}${path}`, {
    method: init.method || "GET",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  const text = await res.text();
  let body: Json = {};
  if (text) {
    try {
      body = JSON.parse(text) as Json;
    } catch {
      body = { message: text };
    }
  }
  return { status: res.status, body };
}

function mapOrderMethod(method: PaysuiteMethod): string {
  switch (method) {
    case "mpesa":
      return "MPESA";
    case "emola":
      return "EMOLA";
    case "credit_card":
      return "CREDIT_CARD";
    default: {
      const _exhaustive: never = method;
      return _exhaustive;
    }
  }
}

async function runCheckoutSaga(
  authorization: string | undefined,
  command: CheckoutCommand,
  idempotencyKey?: string,
): Promise<{ status: number; result: CheckoutSagaResult | Json }> {
  const sagaId = `saga_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
  const steps: CommerceSagaStep[] = [
    step("validate", "pending"),
    step("create_orders", "pending"),
    step("create_payment", "pending"),
    step("done", "pending"),
  ];

  if (!authorization) {
    steps[0] = step("validate", "error", "Authorization em falta");
    steps[3] = step("failed", "error", "unauthorized");
    return {
      status: 401,
      result: { message: "Não autenticado", sagaId, steps },
    };
  }

  if (!command.paysuiteMethod) {
    steps[0] = step("validate", "error", "paysuiteMethod obrigatório");
    steps[3] = step("failed", "error", "validation");
    return {
      status: 400,
      result: { message: "paysuiteMethod é obrigatório", sagaId, steps },
    };
  }

  steps[0] = step("validate", "ok");

  const orderMethod =
    command.paymentMethod || mapOrderMethod(command.paysuiteMethod);

  const ordersRes = await upstreamFetch("/api/orders/checkout", {
    method: "POST",
    authorization,
    idempotencyKey: idempotencyKey
      ? `${idempotencyKey}:orders`
      : undefined,
    body: {
      addressId: command.addressId,
      paymentMethod: orderMethod,
      notes: command.notes,
      couponCode: command.couponCode,
      affiliateCode: command.affiliateCode,
    },
  });

  if (ordersRes.status >= 400) {
    steps[1] = step(
      "create_orders",
      "error",
      String(ordersRes.body.message || ordersRes.status),
    );
    steps[3] = step("failed", "error", "create_orders");
    return { status: ordersRes.status, result: { ...ordersRes.body, sagaId, steps } };
  }

  steps[1] = step("create_orders", "ok");

  const ordersRaw = ordersRes.body.orders;
  const orders = Array.isArray(ordersRaw)
    ? (ordersRaw as Array<Record<string, unknown>>).map((o) => ({
        id: String(o.id),
        orderNumber: String(o.orderNumber || ""),
        totalCents: Number(o.totalCents || 0),
        sellerShopId: String(o.sellerShopId || ""),
      }))
    : [];

  const orderIds = orders.map((o) => o.id);
  const totalCents = Number(ordersRes.body.totalCents || 0);

  const payRes = await upstreamFetch("/api/billing/paysuite/checkout", {
    method: "POST",
    authorization,
    idempotencyKey: idempotencyKey
      ? `${idempotencyKey}:payment`
      : undefined,
    body: {
      orderIds,
      method: command.paysuiteMethod,
      msisdn: command.msisdn,
    },
  });

  if (payRes.status >= 400) {
    steps[2] = step(
      "create_payment",
      "error",
      String(payRes.body.message || payRes.status),
    );
    steps[3] = step("failed", "error", "create_payment");
    return {
      status: payRes.status,
      result: {
        ...payRes.body,
        sagaId,
        steps,
        orders,
        orderCount: orders.length,
        totalCents,
      },
    };
  }

  steps[2] = step("create_payment", "ok");
  steps[3] = step("done", "ok");

  const result: CheckoutSagaResult = {
    sagaId,
    steps,
    orders,
    orderCount: Number(ordersRes.body.orderCount || orders.length),
    totalCents,
    payment: {
      paymentId: String(payRes.body.paymentId || ""),
      reference: payRes.body.reference
        ? String(payRes.body.reference)
        : undefined,
      status: payRes.body.status ? String(payRes.body.status) : undefined,
      checkoutUrl: payRes.body.checkoutUrl
        ? String(payRes.body.checkoutUrl)
        : payRes.body.url
          ? String(payRes.body.url)
          : undefined,
      url: payRes.body.url ? String(payRes.body.url) : undefined,
      simulated: Boolean(payRes.body.simulated),
      method: payRes.body.method ? String(payRes.body.method) : undefined,
      amountCents:
        typeof payRes.body.amountCents === "number"
          ? payRes.body.amountCents
          : undefined,
      currency: payRes.body.currency
        ? String(payRes.body.currency)
        : undefined,
      message: payRes.body.message
        ? String(payRes.body.message)
        : undefined,
    },
  };

  return { status: 201, result };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
  const path = url.pathname;

  if (
    (path === "/health" || path === "/api/health") &&
    req.method === "GET"
  ) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "commerce-orchestrator",
        upstream,
        mode: "strangler-compose",
      }),
    );
    return;
  }

  if (
    (path === "/api/commerce/checkout" || path === "/commerce/checkout") &&
    req.method === "POST"
  ) {
    try {
      const body = (await readJson(req)) as CheckoutCommand;
      const authorization = req.headers.authorization;
      const idempotencyKey = req.headers["idempotency-key"];
      const { status, result } = await runCheckoutSaga(
        typeof authorization === "string" ? authorization : undefined,
        body,
        typeof idempotencyKey === "string" ? idempotencyKey : undefined,
      );
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message:
            error instanceof Error ? error.message : "Orchestrator error",
        }),
      );
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      message: "Not found",
      service: "commerce-orchestrator",
      hint: "POST /api/commerce/checkout",
    }),
  );
});

server.listen(port, () => {
  console.log(
    `[commerce-orchestrator] :${port} → compose ${upstream} (strangler)`,
  );
});
