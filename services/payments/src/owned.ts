/**
 * Phase 11–30: payments owns PaySuite checkout / status / webhook when PAYMENTS_OWNED≠0.
 * On PAID → orders POST /api/orders/internal/settle-paid (ORDERS_URL, else Nest upstream).
 */
import http from "node:http";
import { randomBytes } from "node:crypto";
import {
  BillingPaymentStatus,
  InboxStatus,
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  PlatformRole,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME } from "@ishopine/shared";
import {
  PaysuiteApiError,
  PaysuiteClient,
  PaysuiteValidationError,
  parsePaysuiteWebhook,
  verifyPaysuiteWebhookSignature,
  type PaysuitePaymentMethod,
} from "./paysuite";
import {
  beginIdempotency,
  completeIdempotency,
  failIdempotency,
  hashBody,
} from "./idempotency";

const prisma = new PrismaClient();
const jwtSecret = process.env.JWT_SECRET || "";
const nestUpstream =
  process.env.UPSTREAM_API_URL || "http://127.0.0.1:4000";
const ordersUpstream =
  process.env.ORDERS_URL || nestUpstream;
const internalSecret =
  process.env.INTERNAL_SERVICE_SECRET || process.env.CRON_SECRET || "";
const isProd = process.env.NODE_ENV === "production";

const METHOD_TO_ORDER: Record<PaysuitePaymentMethod, PaymentMethod> = {
  mpesa: PaymentMethod.MPESA,
  emola: PaymentMethod.EMOLA,
  credit_card: PaymentMethod.CREDIT_CARD,
};

const METHODS = new Set<PaysuitePaymentMethod>([
  "mpesa",
  "emola",
  "credit_card",
]);

type JwtPayload = { sub: string; tfa?: boolean };

let client: PaysuiteClient | null = null;
const token = process.env.PAYSUITE_TOKEN?.trim();
if (token) {
  client = new PaysuiteClient({
    token,
    baseUrl: process.env.PAYSUITE_BASE_URL,
    timeoutMs: Number(process.env.PAYSUITE_TIMEOUT_MS || 30_000),
    maxRetries: Number(process.env.PAYSUITE_MAX_RETRIES || 3),
  });
}

const orgSlug = process.env.PLATFORM_ORG_SLUG || "ishopine";

type DbUser = {
  id: string;
  platformRole: PlatformRole;
  totpEnabled: boolean;
  canSell: boolean;
};

async function loadUser(userId: string): Promise<DbUser | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      platformRole: true,
      totpEnabled: true,
      canSell: true,
    },
  });
}

/** Nest TwoFactorGuard parity for platform admin mutations. */
async function assertStaff2fa(user: DbUser, jwtUser: JwtPayload) {
  if (user.totpEnabled) {
    if (!jwtUser.tfa) {
      throw httpError(
        403,
        "Autenticação de dois fatores necessária. Complete o login 2FA.",
      );
    }
    return;
  }
  const settings = await prisma.platformSettings.findFirst({
    where: { organization: { slug: orgSlug } },
  });
  if ((settings?.requireSeller2fa ?? true) && isProd) {
    throw httpError(
      403,
      "Configure a autenticação de dois fatores antes de acessar o painel.",
    );
  }
}

async function assertPlatformStaff(jwtUser: JwtPayload) {
  const user = await loadUser(jwtUser.sub);
  if (!user) throw httpError(401, "Não autenticado");
  if (
    user.platformRole !== PlatformRole.PLATFORM_ADMIN &&
    user.platformRole !== PlatformRole.PLATFORM_OPERATOR
  ) {
    throw httpError(403, "Acesso não autorizado para este perfil");
  }
  await assertStaff2fa(user, jwtUser);
  return user;
}

async function createSellerPayout(
  _actor: DbUser,
  input: {
    reference: string;
    amountCents: number;
    method: "mpesa" | "emola";
    phone: string;
    holder: string;
    description?: string;
  },
) {
  if (input.amountCents <= 0) {
    throw httpError(400, "Valor de payout inválido");
  }
  if (!client) {
    throw httpError(
      503,
      "PaySuite não configurado. Defina PAYSUITE_TOKEN.",
    );
  }
  const phone = normalizeMsisdn(input.phone) || input.phone;
  try {
    return await client.createPayout({
      amount: (input.amountCents / 100).toFixed(2),
      reference: input.reference.slice(0, 50),
      method: input.method,
      description: input.description,
      beneficiary: {
        phone: phone.replace(/^258/, ""),
        holder: input.holder,
      },
    });
  } catch (error) {
    throw httpError(400, mapPaysuiteError(error));
  }
}

async function createRefund(
  _actor: DbUser,
  input: { paymentId: string; amountCents: number; reason?: string },
) {
  const payment = await prisma.billingPayment.findUnique({
    where: { id: input.paymentId },
  });
  if (!payment?.paysuitePaymentId) {
    throw httpError(404, "Pagamento PaySuite não encontrado");
  }
  if (payment.status !== BillingPaymentStatus.PAID) {
    throw httpError(400, "Só é possível reembolsar pagamentos pagos");
  }
  if (!client) {
    throw httpError(503, "PaySuite não configurado");
  }
  if (input.amountCents <= 0) {
    throw httpError(400, "Valor de reembolso inválido");
  }
  try {
    const refund = await client.createRefund({
      payment_id: payment.paysuitePaymentId,
      amount: (input.amountCents / 100).toFixed(2),
      reason: input.reason,
    });
    if (input.amountCents >= payment.amountCents) {
      await prisma.billingPayment.update({
        where: { id: payment.id },
        data: { status: BillingPaymentStatus.REFUNDED },
      });
    }
    return refund;
  } catch (error) {
    throw httpError(400, mapPaysuiteError(error));
  }
}

function allowSimulate(): boolean {
  if (isProd) return false;
  if (process.env.PAYSUITE_SIMULATE === "true") return true;
  return !client;
}


function webUrl() {
  return process.env.WEB_URL || "http://localhost:3000";
}

function apiPublicUrl() {
  return (
    process.env.APP_URL ||
    process.env.API_PUBLIC_URL ||
    process.env.PAYMENTS_PUBLIC_URL ||
    `http://localhost:${process.env.API_PORT || 4000}`
  );
}

function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${name}=`)) continue;
    return decodeURIComponent(trimmed.slice(name.length + 1));
  }
  return null;
}

function extractToken(req: http.IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return parseCookie(req.headers.cookie, AUTH_COOKIE_NAME);
}

function verifyUser(req: http.IncomingMessage): JwtPayload | null {
  const tokenJwt = extractToken(req);
  if (!tokenJwt || !jwtSecret) return null;
  try {
    return jwt.verify(tokenJwt, jwtSecret) as JwtPayload;
  } catch {
    return null;
  }
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function pathOnly(url?: string) {
  return (url || "/").split("?")[0];
}

function readRawBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const raw = await readRawBody(req);
  if (raw.length === 0) return {};
  return JSON.parse(raw.toString("utf8"));
}

function httpError(status: number, message: string) {
  const err = new Error(message);
  (err as Error & { status: number }).status = status;
  return err;
}

function shortReference() {
  return `ISH${Date.now().toString(36)}${randomBytes(3).toString("hex")}`.slice(
    0,
    50,
  );
}

function normalizeMsisdn(raw?: string): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("258")) return digits;
  if (digits.startsWith("8") && digits.length === 9) return `258${digits}`;
  return digits;
}

function mapPaysuiteError(error: unknown): string {
  if (error instanceof PaysuiteValidationError) return error.message;
  if (error instanceof PaysuiteApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Erro PaySuite desconhecido";
}

async function loadPayableOrders(buyerId: string, orderIds: string[]) {
  const uniqueIds = [...new Set(orderIds)];
  const orders = await prisma.order.findMany({
    where: { id: { in: uniqueIds }, buyerId },
    include: { payments: true },
  });
  if (orders.length !== uniqueIds.length) {
    throw httpError(
      400,
      "Um ou mais pedidos não foram encontrados para este comprador",
    );
  }
  for (const order of orders) {
    if (order.paymentStatus === PaymentStatus.PAID) {
      throw httpError(400, `Pedido ${order.orderNumber} já está pago`);
    }
    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.REFUNDED
    ) {
      throw httpError(400, `Pedido ${order.orderNumber} não pode ser cobrado`);
    }
  }
  const amountCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
  if (amountCents <= 0) throw httpError(400, "Valor a pagar inválido");
  return { orders, amountCents };
}

/** Orders settlePaidOrders — affiliates + wallet + subscriptions. */
async function callOrdersSettlePaid(orderIds: string[]) {
  if (!internalSecret) {
    throw httpError(
      503,
      "INTERNAL_SERVICE_SECRET/CRON_SECRET em falta para settle",
    );
  }
  const res = await fetch(
    `${ordersUpstream.replace(/\/$/, "")}/api/orders/internal/settle-paid`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${internalSecret}`,
      },
      body: JSON.stringify({ orderIds }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw httpError(
      502,
      `Settle orders falhou (${res.status}): ${text.slice(0, 300)}`,
    );
  }
  return res.json();
}

async function markBillingPaid(
  paymentId: string,
  extras: {
    paysuitePaymentId?: string | null;
    paysuiteTransactionId?: string | null;
  },
) {
  const payment = await prisma.billingPayment.findUnique({
    where: { id: paymentId },
  });
  if (!payment) return;
  if (payment.status === BillingPaymentStatus.PAID) return;

  await prisma.billingPayment.update({
    where: { id: paymentId },
    data: {
      status: BillingPaymentStatus.PAID,
      paidAt: new Date(),
      paysuitePaymentId:
        extras.paysuitePaymentId ?? payment.paysuitePaymentId,
      paysuiteTransactionId:
        extras.paysuiteTransactionId ?? payment.paysuiteTransactionId,
    },
  });

  try {
    await callOrdersSettlePaid(payment.orderIds);
  } catch (error) {
    console.error("[payments] orders settle failed", paymentId, error);
  }

  await prisma.outboxMessage.create({
    data: {
      aggregateType: "BillingPayment",
      aggregateId: payment.id,
      eventType: "billing.payment.paid",
      payload: {
        paymentId: payment.id,
        buyerId: payment.buyerId,
        reference: payment.reference,
        amountCents: payment.amountCents,
        currency: payment.currency,
        orderIds: payment.orderIds,
      },
    },
  });
}

async function createPaysuiteCheckout(
  buyerId: string,
  orderIds: string[],
  method: PaysuitePaymentMethod,
  rawMsisdn?: string,
) {
  const buyer = await prisma.user.findUnique({ where: { id: buyerId } });
  if (!buyer) throw httpError(403, "Forbidden");

  const { orders, amountCents } = await loadPayableOrders(buyerId, orderIds);
  const msisdn = normalizeMsisdn(rawMsisdn);
  const reference = shortReference();
  const orderMethod = METHOD_TO_ORDER[method];
  const amountMzn = (amountCents / 100).toFixed(2);

  const payment = await prisma.billingPayment.create({
    data: {
      buyerId,
      provider: PaymentProvider.PAYSUITE,
      status: BillingPaymentStatus.PENDING,
      amountCents,
      currency: "MZN",
      orderIds: orders.map((o) => o.id),
      method,
      reference,
      msisdn,
      metadata: {
        orderNumbers: orders.map((o) => o.orderNumber),
        buyerEmail: buyer.email,
      },
    },
  });

  await prisma.order.updateMany({
    where: { id: { in: orders.map((o) => o.id) } },
    data: { paymentMethod: orderMethod },
  });
  await prisma.payment.updateMany({
    where: { orderId: { in: orders.map((o) => o.id) } },
    data: { method: orderMethod },
  });

  const returnUrl = `${webUrl()}/pagamento/sucesso?ref=${encodeURIComponent(reference)}`;
  const callbackUrl = `${apiPublicUrl()}/api/billing/paysuite/webhook`;

  if (allowSimulate() && !client) {
    await markBillingPaid(payment.id, {
      paysuitePaymentId: `sim_${payment.id}`,
      paysuiteTransactionId: `sim_tx_${Date.now()}`,
    });
    return {
      paymentId: payment.id,
      reference,
      provider: PaymentProvider.PAYSUITE,
      method,
      status: BillingPaymentStatus.PAID,
      amountCents,
      currency: "MZN",
      checkoutUrl: `${webUrl()}/pagamento/sucesso?simulated=1&paymentId=${payment.id}`,
      url: `${webUrl()}/pagamento/sucesso?simulated=1&paymentId=${payment.id}`,
      simulated: true,
      message:
        "Simulação local (defina PAYSUITE_TOKEN para cobranças reais — PaySuite não tem sandbox).",
    };
  }

  if (!client) {
    throw httpError(
      503,
      "PaySuite não configurado. Defina PAYSUITE_TOKEN (painel PaySuite → API Access).",
    );
  }

  try {
    const created = await client.createPayment({
      amount: amountMzn,
      reference,
      method,
      description: `iShopine · ${orders.length} pedido(s)`.slice(0, 125),
      return_url: returnUrl,
      callback_url: callbackUrl,
    });

    await prisma.billingPayment.update({
      where: { id: payment.id },
      data: {
        status: BillingPaymentStatus.PROCESSING,
        paysuitePaymentId: created.id,
        paysuiteCheckoutUrl: created.checkout_url,
        metadata: {
          orderNumbers: orders.map((o) => o.orderNumber),
          buyerEmail: buyer.email,
          paysuiteStatus: created.status,
          msisdnHint: msisdn,
        },
      },
    });

    if (!created.checkout_url) {
      throw httpError(
        400,
        "PaySuite não devolveu checkout_url — verifique a conta comerciante",
      );
    }

    return {
      paymentId: payment.id,
      reference,
      provider: PaymentProvider.PAYSUITE,
      method,
      status: BillingPaymentStatus.PROCESSING,
      amountCents,
      currency: "MZN",
      paysuitePaymentId: created.id,
      checkoutUrl: created.checkout_url,
      url: created.checkout_url,
      simulated: false,
      message: "Redirecione o comprador para o checkout PaySuite.",
    };
  } catch (error) {
    const message = mapPaysuiteError(error);
    await prisma.billingPayment.update({
      where: { id: payment.id },
      data: {
        status: BillingPaymentStatus.FAILED,
        failureReason: message,
      },
    });
    throw httpError(400, message);
  }
}

async function syncPaysuiteStatus(buyerId: string, paymentId: string) {
  const payment = await prisma.billingPayment.findUnique({
    where: { id: paymentId },
  });
  if (!payment || payment.buyerId !== buyerId) {
    throw httpError(404, "Pagamento não encontrado");
  }
  if (payment.provider !== PaymentProvider.PAYSUITE) {
    throw httpError(400, "Pagamento não é PaySuite");
  }

  if (
    payment.status === BillingPaymentStatus.PAID ||
    payment.status === BillingPaymentStatus.FAILED ||
    payment.status === BillingPaymentStatus.CANCELLED ||
    payment.status === BillingPaymentStatus.REFUNDED
  ) {
    return {
      paymentId: payment.id,
      reference: payment.reference,
      status: payment.status,
      message: payment.failureReason || undefined,
    };
  }

  if (!payment.paysuitePaymentId) {
    return {
      paymentId: payment.id,
      reference: payment.reference,
      status: payment.status,
      message: "Aguardando id PaySuite",
    };
  }

  if (allowSimulate() && payment.paysuitePaymentId.startsWith("sim_")) {
    await markBillingPaid(payment.id, {});
    return {
      paymentId: payment.id,
      reference: payment.reference,
      status: BillingPaymentStatus.PAID,
      message: "Simulado",
    };
  }

  if (!client) {
    throw httpError(503, "PaySuite não configurado");
  }

  try {
    const remote = await client.getPayment(payment.paysuitePaymentId);
    const remoteStatus = String(remote.status || "").toLowerCase();

    if (remoteStatus === "paid" || remoteStatus === "completed") {
      await markBillingPaid(payment.id, {
        paysuiteTransactionId:
          remote.transaction?.transaction_id ||
          (remote.transaction?.id != null
            ? String(remote.transaction.id)
            : undefined),
      });
      return {
        paymentId: payment.id,
        reference: payment.reference,
        status: BillingPaymentStatus.PAID,
        message: "Pago",
      };
    }

    if (
      remoteStatus === "failed" ||
      remoteStatus === "cancelled" ||
      remoteStatus === "canceled" ||
      remoteStatus === "expired"
    ) {
      const mapped =
        remoteStatus === "expired" || remoteStatus.includes("cancel")
          ? BillingPaymentStatus.CANCELLED
          : BillingPaymentStatus.FAILED;
      await prisma.billingPayment.update({
        where: { id: payment.id },
        data: {
          status: mapped,
          failureReason: remote.error || remoteStatus,
        },
      });
      return {
        paymentId: payment.id,
        reference: payment.reference,
        status: mapped,
        message: remote.error || remoteStatus,
      };
    }

    return {
      paymentId: payment.id,
      reference: payment.reference,
      status: BillingPaymentStatus.PROCESSING,
      message: remoteStatus || "pending",
    };
  } catch (error) {
    throw httpError(400, mapPaysuiteError(error));
  }
}

async function handleWebhook(
  rawBody: Buffer,
  signature: string | undefined,
  accountId?: string,
) {
  const secret = process.env.PAYSUITE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw httpError(503, "Webhook secret não configurado");
  }
  if (!verifyPaysuiteWebhookSignature(rawBody, signature, secret)) {
    throw httpError(401, "Assinatura PaySuite inválida");
  }

  const payload = parsePaysuiteWebhook(rawBody);
  const requestId =
    payload.request_id ||
    `${payload.event}:${payload.data?.id}:${payload.created_at || Date.now()}`;

  // Inbox dedupe (Nest InboxService parity)
  let inboxId: string;
  let alreadyProcessed = false;
  let duplicate = false;
  const existing = await prisma.inboxMessage.findUnique({
    where: {
      source_messageKey: { source: "paysuite", messageKey: requestId },
    },
  });
  if (existing) {
    inboxId = existing.id;
    duplicate = true;
    alreadyProcessed = existing.status === InboxStatus.PROCESSED;
  } else {
    try {
      const created = await prisma.inboxMessage.create({
        data: {
          source: "paysuite",
          messageKey: requestId,
          eventType: payload.event,
          payload: payload as unknown as Prisma.InputJsonValue,
          headers: { accountId, signaturePresent: Boolean(signature) },
          status: InboxStatus.RECEIVED,
          maxAttempts: 5,
        },
      });
      inboxId = created.id;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const again = await prisma.inboxMessage.findUniqueOrThrow({
          where: {
            source_messageKey: { source: "paysuite", messageKey: requestId },
          },
        });
        inboxId = again.id;
        duplicate = true;
        alreadyProcessed = again.status === InboxStatus.PROCESSED;
      } else {
        throw error;
      }
    }
  }

  await prisma.billingWebhookEvent.upsert({
    where: { requestId },
    create: {
      requestId,
      event: payload.event,
      payload: payload as unknown as Prisma.InputJsonValue,
      paymentId: payload.data?.id,
      processedAt: alreadyProcessed ? new Date() : null,
    },
    update: {
      event: payload.event,
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  });

  if (alreadyProcessed) {
    return { received: true, duplicate: true, via: "inbox" };
  }

  try {
    const paysuiteId = payload.data?.id;
    const reference = payload.data?.reference;
    const payment = paysuiteId
      ? await prisma.billingPayment.findFirst({
          where: {
            OR: [
              { paysuitePaymentId: paysuiteId },
              ...(reference ? [{ reference }] : []),
            ],
          },
        })
      : reference
        ? await prisma.billingPayment.findUnique({ where: { reference } })
        : null;

    if (payment) {
      if (payload.event === "payment.success") {
        await markBillingPaid(payment.id, {
          paysuitePaymentId: paysuiteId || payment.paysuitePaymentId,
          paysuiteTransactionId:
            payload.data.transaction?.transaction_id ||
            (payload.data.transaction?.id != null
              ? String(payload.data.transaction.id)
              : undefined),
        });
      } else if (payload.event === "payment.failed") {
        await prisma.billingPayment.update({
          where: { id: payment.id },
          data: {
            status: BillingPaymentStatus.FAILED,
            failureReason: payload.data.error || "payment.failed",
          },
        });
        await prisma.outboxMessage.create({
          data: {
            aggregateType: "BillingPayment",
            aggregateId: payment.id,
            eventType: "billing.payment.failed",
            payload: {
              paymentId: payment.id,
              buyerId: payment.buyerId,
              reference: payment.reference,
            },
          },
        });
      }
    } else {
      console.warn(
        `[payments] webhook sem pagamento local: ${payload.event} ${paysuiteId || reference}`,
      );
    }

    await prisma.inboxMessage.update({
      where: { id: inboxId },
      data: {
        status: InboxStatus.PROCESSED,
        processedAt: new Date(),
        lastError: null,
      },
    });
    await prisma.billingWebhookEvent.update({
      where: { requestId },
      data: {
        processedAt: new Date(),
        paymentId: payment?.id || paysuiteId,
      },
    });

    return { received: true, duplicate, via: "inbox" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "webhook processing failed";
    const current = await prisma.inboxMessage.findUniqueOrThrow({
      where: { id: inboxId },
    });
    const attempts = current.attempts + 1;
    await prisma.inboxMessage.update({
      where: { id: inboxId },
      data: {
        attempts,
        lastError: message.slice(0, 1000),
        status:
          attempts >= current.maxAttempts
            ? InboxStatus.DEAD
            : InboxStatus.FAILED,
      },
    });
    throw error;
  }
}

export async function handleOwnedPayments(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  const path = pathOnly(req.url);
  const method = req.method || "GET";

  try {
    if (path === "/api/billing/paysuite/webhook" && method === "POST") {
      const raw = await readRawBody(req);
      const signature =
        typeof req.headers["x-webhook-signature"] === "string"
          ? req.headers["x-webhook-signature"]
          : undefined;
      const accountId =
        typeof req.headers["x-account-id"] === "string"
          ? req.headers["x-account-id"]
          : undefined;
      const result = await handleWebhook(raw, signature, accountId);
      json(res, 200, result);
      return true;
    }

    if (path === "/api/billing/paysuite/checkout" && method === "POST") {
      const user = verifyUser(req);
      if (!user) {
        json(res, 401, { message: "Não autenticado" });
        return true;
      }
      const body = (await readJsonBody(req)) as {
        orderIds?: string[];
        method?: string;
        msisdn?: string;
      };
      if (!Array.isArray(body.orderIds) || body.orderIds.length === 0) {
        throw httpError(400, "orderIds obrigatório");
      }
      if (!body.method || !METHODS.has(body.method as PaysuitePaymentMethod)) {
        throw httpError(400, "method inválido (mpesa|emola|credit_card)");
      }

      const idemKeyHeader = req.headers["idempotency-key"];
      const idemKey =
        typeof idemKeyHeader === "string" ? idemKeyHeader : undefined;
      const begin = await beginIdempotency(prisma, idemKey, hashBody(body));
      if (begin.kind === "replay") {
        res.writeHead(begin.responseCode, {
          "Content-Type": "application/json",
          "X-Idempotent-Replayed": "1",
        });
        res.end(JSON.stringify(begin.responseBody));
        return true;
      }
      if (begin.kind === "in_flight") {
        json(res, 409, {
          message: "Checkout PaySuite já em progresso (idempotency)",
        });
        return true;
      }
      const startedKey = begin.kind === "started" ? begin.key : null;
      try {
        const result = await createPaysuiteCheckout(
          user.sub,
          body.orderIds,
          body.method as PaysuitePaymentMethod,
          body.msisdn,
        );
        if (startedKey) {
          await completeIdempotency(prisma, startedKey, 201, result);
        }
        json(res, 201, result);
      } catch (error) {
        if (startedKey) {
          await failIdempotency(prisma, startedKey).catch(() => undefined);
        }
        throw error;
      }
      return true;
    }

    const statusMatch = path.match(
      /^\/api\/billing\/paysuite\/status\/([^/]+)$/,
    );
    if (statusMatch && method === "GET") {
      const user = verifyUser(req);
      if (!user) {
        json(res, 401, { message: "Não autenticado" });
        return true;
      }
      const result = await syncPaysuiteStatus(user.sub, statusMatch[1]);
      json(res, 200, result);
      return true;
    }

    if (path === "/api/billing/paysuite/payouts" && method === "POST") {
      const jwtUser = verifyUser(req);
      if (!jwtUser) {
        json(res, 401, { message: "Não autenticado" });
        return true;
      }
      const actor = await assertPlatformStaff(jwtUser);
      const body = (await readJsonBody(req)) as {
        reference?: string;
        amountCents?: number;
        method?: string;
        phone?: string;
        holder?: string;
        description?: string;
      };
      if (!body.reference?.trim()) {
        throw httpError(400, "reference obrigatório");
      }
      if (typeof body.amountCents !== "number") {
        throw httpError(400, "amountCents obrigatório");
      }
      if (body.method !== "mpesa" && body.method !== "emola") {
        throw httpError(400, "method deve ser mpesa ou emola");
      }
      if (!body.phone || !body.holder) {
        throw httpError(400, "phone e holder obrigatórios");
      }
      const payout = await createSellerPayout(actor, {
        reference: body.reference,
        amountCents: body.amountCents,
        method: body.method,
        phone: body.phone,
        holder: body.holder,
        description: body.description,
      });
      json(res, 201, payout);
      return true;
    }

    if (path === "/api/billing/paysuite/refunds" && method === "POST") {
      const jwtUser = verifyUser(req);
      if (!jwtUser) {
        json(res, 401, { message: "Não autenticado" });
        return true;
      }
      const actor = await assertPlatformStaff(jwtUser);
      const body = (await readJsonBody(req)) as {
        paymentId?: string;
        amountCents?: number;
        reason?: string;
      };
      if (!body.paymentId) throw httpError(400, "paymentId obrigatório");
      if (typeof body.amountCents !== "number") {
        throw httpError(400, "amountCents obrigatório");
      }
      const refund = await createRefund(actor, {
        paymentId: body.paymentId,
        amountCents: body.amountCents,
        reason: body.reason,
      });
      json(res, 201, refund);
      return true;
    }

    return false;
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status: number }).status)
        : 400;
    json(res, status || 400, {
      message: error instanceof Error ? error.message : "Erro",
    });
    return true;
  }
}
