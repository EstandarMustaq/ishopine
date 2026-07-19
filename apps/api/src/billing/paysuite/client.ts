import {
  PaysuiteApiError,
  PaysuiteValidationError,
} from './errors';
import type {
  CreatePaymentRequest,
  CreatePayoutRequest,
  CreateRefundRequest,
  PaysuiteApiResponse,
  PaysuitePaymentData,
  PaysuitePaymentMethod,
  PaysuitePayoutData,
  PaysuiteRefundData,
} from './types';

const DEFAULT_BASE_URL = 'https://paysuite.tech/api/v1';
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

const PAYMENT_METHODS = new Set<PaysuitePaymentMethod>([
  'mpesa',
  'emola',
  'credit_card',
]);

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isUlid(value: string): boolean {
  return /^[0-9A-HJKMNP-TV-Z]{26}$/i.test(value);
}

function isPaymentId(value: string): boolean {
  return isUuid(value) || isUlid(value);
}

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface PaysuiteClientOptions {
  token: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** Max retries on 429 / 5xx (default 3) */
  maxRetries?: number;
}

/**
 * TypeScript SDK for PaySuite (paysuite.co.mz / paysuite.tech),
 * aligned with hypertech/paysuite-php-sdk + official REST API.
 */
export class PaysuiteClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: PaysuiteClientOptions) {
    const token = options.token?.trim();
    if (!token) {
      throw new PaysuiteValidationError('PaySuite token cannot be empty');
    }
    this.token = token;
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? MAX_RETRIES;
  }

  validateCreatePayment(data: CreatePaymentRequest): void {
    if (data.amount === undefined || data.amount === null || data.amount === '') {
      throw new PaysuiteValidationError('Missing required field: amount');
    }
    if (!data.reference?.trim()) {
      throw new PaysuiteValidationError('Missing required field: reference');
    }
    if (String(data.reference).length > 50) {
      throw new PaysuiteValidationError('reference must be at most 50 characters');
    }
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new PaysuiteValidationError('Amount must be a positive number');
    }
    if (data.method && !PAYMENT_METHODS.has(data.method)) {
      throw new PaysuiteValidationError(
        'method must be one of: mpesa, emola, credit_card',
      );
    }
    if (data.description && data.description.length > 125) {
      throw new PaysuiteValidationError(
        'description must be at most 125 characters',
      );
    }
    if (data.return_url && !isValidUrl(data.return_url)) {
      throw new PaysuiteValidationError('Invalid return_url');
    }
    if (data.callback_url && !isValidUrl(data.callback_url)) {
      throw new PaysuiteValidationError('Invalid callback_url');
    }
  }

  async createPayment(
    data: CreatePaymentRequest,
  ): Promise<PaysuitePaymentData> {
    this.validateCreatePayment(data);
    const body = {
      amount:
        typeof data.amount === 'number'
          ? data.amount.toFixed(2)
          : String(data.amount),
      reference: data.reference.trim(),
      ...(data.description
        ? { description: data.description.slice(0, 125) }
        : {}),
      ...(data.method ? { method: data.method } : {}),
      ...(data.return_url ? { return_url: data.return_url } : {}),
      ...(data.callback_url ? { callback_url: data.callback_url } : {}),
    };

    const response = await this.request<PaysuitePaymentData>(
      'POST',
      'payments',
      body,
    );
    if (response.status !== 'success' || !response.data?.id) {
      throw new PaysuiteApiError(
        response.message || 'Failed to create PaySuite payment',
        402,
        response,
      );
    }
    return response.data;
  }

  async getPayment(id: string): Promise<PaysuitePaymentData> {
    if (!isPaymentId(id)) {
      throw new PaysuiteValidationError('Invalid payment id format');
    }
    const response = await this.request<PaysuitePaymentData>(
      'GET',
      `payments/${id}`,
    );
    if (response.status !== 'success' || !response.data) {
      throw new PaysuiteApiError(
        response.message || 'Payment not found',
        404,
        response,
      );
    }
    return response.data;
  }

  async createPayout(data: CreatePayoutRequest): Promise<PaysuitePayoutData> {
    if (!data.reference?.trim()) {
      throw new PaysuiteValidationError('Missing required field: reference');
    }
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new PaysuiteValidationError('Amount must be a positive number');
    }
    if (!data.beneficiary?.phone || !data.beneficiary?.holder) {
      throw new PaysuiteValidationError(
        'beneficiary.phone and beneficiary.holder are required',
      );
    }

    const response = await this.request<PaysuitePayoutData>('POST', 'payouts', {
      amount: amount.toFixed(2),
      reference: data.reference.trim(),
      method: data.method,
      description: data.description,
      beneficiary: data.beneficiary,
    });

    if (!response.data?.id && response.status !== 'success') {
      throw new PaysuiteApiError(
        response.message || 'Failed to create payout',
        400,
        response,
      );
    }
    return (response.data || (response as unknown as PaysuitePayoutData)) as PaysuitePayoutData;
  }

  async getPayout(id: string): Promise<PaysuitePayoutData> {
    if (!isPaymentId(id)) {
      throw new PaysuiteValidationError('Invalid payout id format');
    }
    const response = await this.request<PaysuitePayoutData>(
      'GET',
      `payouts/${id}`,
    );
    if (!response.data && response.status === 'error') {
      throw new PaysuiteApiError(
        response.message || 'Payout not found',
        404,
        response,
      );
    }
    return (response.data ||
      (response as unknown as PaysuitePayoutData)) as PaysuitePayoutData;
  }

  async createRefund(data: CreateRefundRequest): Promise<PaysuiteRefundData> {
    if (!data.payment_id) {
      throw new PaysuiteValidationError('Missing required field: payment_id');
    }
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new PaysuiteValidationError('Amount must be a positive number');
    }
    const response = await this.request<PaysuiteRefundData>('POST', 'refunds', {
      payment_id: data.payment_id,
      amount: amount.toFixed(2),
      ...(data.reason ? { reason: data.reason } : {}),
    });
    if (response.status !== 'success' || !response.data) {
      throw new PaysuiteApiError(
        response.message || 'Failed to create refund',
        422,
        response,
      );
    }
    return response.data;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<PaysuiteApiResponse<T>> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.maxRetries) {
      attempt += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(`${this.baseUrl}/${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${this.token}`,
          },
          body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
          signal: controller.signal,
        });

        const text = await response.text();
        let parsed: PaysuiteApiResponse<T>;
        try {
          parsed = JSON.parse(text) as PaysuiteApiResponse<T>;
        } catch {
          throw new PaysuiteApiError(
            `Invalid JSON from PaySuite (${response.status})`,
            response.status,
            text.slice(0, 300),
          );
        }

        if (response.status === 429 || response.status >= 500) {
          if (attempt <= this.maxRetries) {
            await this.sleep(2 ** attempt * 200);
            continue;
          }
        }

        if (response.status >= 400) {
          throw new PaysuiteApiError(
            parsed.message || `PaySuite HTTP ${response.status}`,
            response.status,
            parsed,
          );
        }

        return parsed;
      } catch (error) {
        lastError = error;
        if (
          error instanceof PaysuiteApiError &&
          error.statusCode < 500 &&
          error.statusCode !== 429
        ) {
          throw error;
        }
        if (attempt > this.maxRetries) break;
        await this.sleep(2 ** attempt * 200);
      } finally {
        clearTimeout(timer);
      }
    }

    if (lastError instanceof Error) throw lastError;
    throw new PaysuiteApiError('PaySuite request failed', 500, lastError);
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
