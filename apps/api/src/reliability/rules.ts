/**
 * iShopine — rigid reliability rules (inbox / outbox / idempotency / projections)
 * These constants are the system contract; handlers must not weaken them.
 */
export const RELIABILITY_RULES = {
  inbox: {
    /** Unique key is always (source, messageKey). Duplicates return existing row. */
    uniqueKey: 'source+messageKey' as const,
    maxAttempts: 5,
    /** Exponential backoff base (ms): 250, 500, 1000, 2000, 4000 */
    backoffBaseMs: 250,
    /** Process claim lease — message stuck in PROCESSING longer than this is reclaimable */
    processingLeaseMs: 30_000,
    /** Respond to webhook producer within this budget */
    ackBudgetMs: 4_000,
  },
  outbox: {
    maxAttempts: 8,
    backoffBaseMs: 200,
    /** Dispatcher poll interval for low-latency sync */
    pollIntervalMs: 750,
    batchSize: 25,
    publishingLeaseMs: 20_000,
  },
  idempotency: {
    header: 'idempotency-key',
    /** Default TTL for completed keys */
    ttlHours: 24,
    keyMaxLength: 128,
    scopes: {
      paysuiteCheckout: 'billing:paysuite:checkout',
      orderCheckout: 'orders:checkout',
    },
  },
  projections: {
    names: {
      buyerBillingSummary: 'buyer_billing_summary',
      platformSecuritySync: 'platform_security_sync',
      platformOpsPulse: 'platform_ops_pulse',
    },
    /** Projection write must be idempotent on (name, partitionKey) */
    uniqueKey: 'name+partitionKey' as const,
  },
} as const;

export function inboxBackoffMs(attempt: number): number {
  const base = RELIABILITY_RULES.inbox.backoffBaseMs;
  return Math.min(base * 2 ** Math.max(0, attempt - 1), 60_000);
}

export function outboxBackoffMs(attempt: number): number {
  const base = RELIABILITY_RULES.outbox.backoffBaseMs;
  return Math.min(base * 2 ** Math.max(0, attempt - 1), 120_000);
}
