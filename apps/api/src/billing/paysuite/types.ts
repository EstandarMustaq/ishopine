export type PaysuitePaymentMethod = 'mpesa' | 'emola' | 'credit_card';

export type PaysuitePaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | string;

export interface CreatePaymentRequest {
  amount: number | string;

  reference: string;
  description?: string;
  method?: PaysuitePaymentMethod;
  return_url?: string;
  callback_url?: string;
}

export interface PaysuiteTransaction {
  id?: string | number;
  status?: string;
  method?: string;
  transaction_id?: string;
  paid_at?: string;
}

export interface PaysuitePaymentData {
  id: string;
  amount: number;
  reference: string;
  status: PaysuitePaymentStatus;
  checkout_url?: string;
  transaction?: PaysuiteTransaction;
  error?: string;
}

export interface PaysuiteApiResponse<T> {
  status: 'success' | 'error' | string;
  message?: string;
  data?: T;
}

export interface CreatePayoutRequest {
  amount: number | string;
  reference: string;
  method: 'mpesa' | 'emola' | string;
  description?: string;
  beneficiary: {
    phone: string;
    holder: string;
  };
}

export interface PaysuitePayoutData {
  id: string;
  amount: number;
  reference: string;
  status: string;
  description?: string;
  method?: string;
  beneficiary?: { phone?: string; holder?: string };
  created_at?: string;
}

export interface CreateRefundRequest {
  payment_id: string;
  amount: number | string;
  reason?: string;
}

export interface PaysuiteRefundData {
  id: string;
  payment_id: string;
  amount: number;
  status: string;
  reason?: string;
}

export interface PaysuiteWebhookPayload {
  event: string;
  data: {
    id: string;
    amount?: number;
    reference?: string;
    error?: string;
    transaction?: PaysuiteTransaction;
  };
  created_at?: number;
  request_id?: string;
}
