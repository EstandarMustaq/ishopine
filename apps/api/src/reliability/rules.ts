export const RELIABILITY_RULES = {
  inbox: {
    uniqueKey: 'source+messageKey' as const,
    maxAttempts: 5,

    backoffBaseMs: 250,

    processingLeaseMs: 30_000,

    ackBudgetMs: 4_000,
  },
  outbox: {
    maxAttempts: 8,
    backoffBaseMs: 200,

    pollIntervalMs: 750,
    batchSize: 25,
    publishingLeaseMs: 20_000,
  },
  idempotency: {
    header: 'idempotency-key',

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
