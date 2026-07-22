/**
 * Checkout idempotency against shared IdempotencyRecord (Nest parity).
 */
import { createHash } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { IDEMPOTENCY_SCOPES } from "@ishopine/shared";

const KEY_MAX = 128;
const TTL_HOURS = 24;

export const CHECKOUT_IDEMPOTENCY_SCOPE = IDEMPOTENCY_SCOPES.ordersCheckout;

export function hashCheckoutBody(body: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(body ?? {}))
    .digest("hex");
}

export type IdempotencyBegin =
  | { kind: "invalid" }
  | { kind: "replay"; responseCode: number; responseBody: unknown }
  | { kind: "in_flight" }
  | { kind: "started"; key: string };

export async function beginIdempotency(
  prisma: PrismaClient,
  key: string | undefined,
  requestHash?: string,
): Promise<IdempotencyBegin> {
  if (!key?.trim()) return { kind: "invalid" };
  const normalized = key.trim().slice(0, KEY_MAX);
  const scope = CHECKOUT_IDEMPOTENCY_SCOPE;

  const existing = await prisma.idempotencyRecord.findUnique({
    where: { scope_key: { scope, key: normalized } },
  });

  if (existing) {
    if (existing.expiresAt < new Date()) {
      await prisma.idempotencyRecord.delete({ where: { id: existing.id } });
    } else if (existing.status === "COMPLETED") {
      return {
        kind: "replay",
        responseCode: existing.responseCode ?? 200,
        responseBody: existing.responseBody,
      };
    } else if (existing.status === "STARTED") {
      return { kind: "in_flight" };
    } else if (existing.status === "FAILED") {
      // Allow retry after a failed attempt.
      await prisma.idempotencyRecord.delete({ where: { id: existing.id } });
    }
  }

  const expiresAt = new Date(Date.now() + TTL_HOURS * 3600_000);
  try {
    await prisma.idempotencyRecord.create({
      data: {
        scope,
        key: normalized,
        requestHash,
        status: "STARTED",
        expiresAt,
      },
    });
    return { kind: "started", key: normalized };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { kind: "in_flight" };
    }
    throw error;
  }
}

export async function completeIdempotency(
  prisma: PrismaClient,
  key: string,
  responseCode: number,
  responseBody: unknown,
) {
  await prisma.idempotencyRecord.update({
    where: {
      scope_key: { scope: CHECKOUT_IDEMPOTENCY_SCOPE, key },
    },
    data: {
      status: "COMPLETED",
      responseCode,
      responseBody: responseBody as Prisma.InputJsonValue,
    },
  });
}

export async function failIdempotency(prisma: PrismaClient, key: string) {
  await prisma.idempotencyRecord.updateMany({
    where: {
      scope: CHECKOUT_IDEMPOTENCY_SCOPE,
      key,
      status: "STARTED",
    },
    data: { status: "FAILED" },
  });
}
