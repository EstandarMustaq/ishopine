import { createHmac, timingSafeEqual } from 'crypto';
import type { PaysuiteWebhookPayload } from './types';

/**
 * Verify PaySuite webhook HMAC-SHA256 signature (X-Webhook-Signature).
 * Mirrors the official docs at https://paysuite.tech/docs/
 */
export function verifyPaysuiteWebhookSignature(
  rawBody: Buffer | string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature || !secret) return false;
  const payload = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  const provided = signature.trim();

  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function parsePaysuiteWebhook(
  rawBody: Buffer | string,
): PaysuiteWebhookPayload {
  const text = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  return JSON.parse(text) as PaysuiteWebhookPayload;
}
