import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { publicEncrypt, constants } from 'crypto';

type MpesaSessionResponse = {
  output_ResponseCode?: string;
  output_ResponseDesc?: string;
  output_SessionID?: string;
};

type MpesaC2bResponse = {
  output_ConversationID?: string;
  output_TransactionID?: string;
  output_ResponseCode?: string;
  output_ResponseDesc?: string;
  output_ThirdPartyReference?: string;
};

type MpesaQueryResponse = {
  output_ConversationID?: string;
  output_ResponseCode?: string;
  output_ResponseDesc?: string;
  output_ThirdPartyReference?: string;
  output_ResponseTransactionStatus?: string;
};

export type MpesaC2bResult = {
  conversationId?: string;
  transactionId?: string;
  thirdPartyReference: string;
  responseCode?: string;
  responseDesc?: string;
  simulated: boolean;
};

export type MpesaQueryResult = {
  status: 'Completed' | 'Pending' | 'Failed' | 'Cancelled' | 'Expired' | 'N/A';
  responseCode?: string;
  responseDesc?: string;
  conversationId?: string;
  simulated: boolean;
};

@Injectable()
export class MpesaClient {
  private readonly logger = new Logger(MpesaClient.name);
  private sessionId: string | null = null;
  private sessionExpiresAt = 0;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const apiKey = this.config.get<string>('MPESA_API_KEY');
    const publicKey = this.config.get<string>('MPESA_PUBLIC_KEY');
    return Boolean(apiKey?.trim() && publicKey?.trim());
  }

  private host(): string {
    const env = this.config.get<string>('MPESA_ENV', 'sandbox');
    return env === 'production'
      ? 'api.vm.co.mz'
      : 'api.sandbox.vm.co.mz';
  }

  private serviceProviderCode(): string {
    return this.config.get<string>('MPESA_SERVICE_PROVIDER_CODE', '171717');
  }

  private toPem(publicKey: string): string {
    const trimmed = publicKey.trim();
    if (trimmed.includes('BEGIN PUBLIC KEY')) {
      return trimmed;
    }
    const body = trimmed.replace(/\s+/g, '');
    const lines = body.match(/.{1,64}/g)?.join('\n') ?? body;
    return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`;
  }

  private encrypt(value: string): string {
    const publicKey = this.config.getOrThrow<string>('MPESA_PUBLIC_KEY');
    const pem = this.toPem(publicKey);
    const encrypted = publicEncrypt(
      {
        key: pem,
        padding: constants.RSA_PKCS1_PADDING,
      },
      Buffer.from(value, 'utf8'),
    );
    return encrypted.toString('base64');
  }

  private async request<T>(
    port: number,
    path: string,
    options: {
      method: 'GET' | 'POST' | 'PUT';
      bearer: string;
      body?: Record<string, string>;
      query?: Record<string, string>;
    },
  ): Promise<T> {
    const url = new URL(`https://${this.host()}:${port}${path}`);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url, {
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.bearer}`,
        Origin: 'developer.mpesa.vm.co.mz',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await response.text();
    let data: T;
    try {
      data = JSON.parse(text) as T;
    } catch {
      throw new Error(
        `M-Pesa respondeu com corpo inválido (${response.status}): ${text.slice(0, 200)}`,
      );
    }

    if (!response.ok) {
      throw new Error(
        `M-Pesa HTTP ${response.status}: ${text.slice(0, 300)}`,
      );
    }

    return data;
  }

  private async getBearerToken(): Promise<string> {
    const now = Date.now();
    if (this.sessionId && now < this.sessionExpiresAt) {
      return this.encrypt(this.sessionId);
    }

    const apiKey = this.config.getOrThrow<string>('MPESA_API_KEY');
    const encryptedApiKey = this.encrypt(apiKey);
    const session = await this.request<MpesaSessionResponse>(
      18349,
      '/ipg/v1x/getSession/',
      {
        method: 'GET',
        bearer: encryptedApiKey,
      },
    );

    if (!session.output_SessionID) {
      throw new Error(
        session.output_ResponseDesc ||
          'Não foi possível obter sessão M-Pesa',
      );
    }

    this.sessionId = session.output_SessionID;
    // Session keys are typically short-lived; refresh proactively.
    this.sessionExpiresAt = now + 50 * 60 * 1000;
    return this.encrypt(this.sessionId);
  }

  async c2bSingleStage(input: {
    amountCents: number;
    msisdn: string;
    transactionReference: string;
    thirdPartyReference: string;
  }): Promise<MpesaC2bResult> {
    const amount = (input.amountCents / 100).toFixed(2);
    const msisdn = input.msisdn.startsWith('258')
      ? input.msisdn
      : `258${input.msisdn}`;

    if (!this.isConfigured()) {
      this.logger.warn(
        'M-Pesa credentials missing — simulating C2B sandbox success',
      );
      return {
        conversationId: `SIM-${input.thirdPartyReference}`,
        transactionId: `SIMTX-${Date.now()}`,
        thirdPartyReference: input.thirdPartyReference,
        responseCode: 'INS-0',
        responseDesc: 'Simulated C2B (configure MPESA_API_KEY)',
        simulated: true,
      };
    }

    const bearer = await this.getBearerToken();
    const response = await this.request<MpesaC2bResponse>(
      18352,
      '/ipg/v1x/c2bPayment/singleStage/',
      {
        method: 'POST',
        bearer,
        body: {
          input_TransactionReference: input.transactionReference.slice(0, 20),
          input_CustomerMSISDN: msisdn,
          input_Amount: amount,
          input_ThirdPartyReference: input.thirdPartyReference.slice(0, 20),
          input_ServiceProviderCode: this.serviceProviderCode(),
        },
      },
    );

    return {
      conversationId: response.output_ConversationID,
      transactionId: response.output_TransactionID,
      thirdPartyReference:
        response.output_ThirdPartyReference || input.thirdPartyReference,
      responseCode: response.output_ResponseCode,
      responseDesc: response.output_ResponseDesc,
      simulated: false,
    };
  }

  async queryStatus(input: {
    thirdPartyReference: string;
    queryReference: string;
  }): Promise<MpesaQueryResult> {
    if (!this.isConfigured()) {
      return {
        status: 'Completed',
        responseCode: 'INS-0',
        responseDesc: 'Simulated Completed',
        conversationId: input.queryReference,
        simulated: true,
      };
    }

    const bearer = await this.getBearerToken();
    const response = await this.request<MpesaQueryResponse>(
      18353,
      '/ipg/v1x/queryTransactionStatus/',
      {
        method: 'GET',
        bearer,
        query: {
          input_ThirdPartyReference: input.thirdPartyReference.slice(0, 20),
          input_QueryReference: input.queryReference,
          input_ServiceProviderCode: this.serviceProviderCode(),
        },
      },
    );

    const raw = (response.output_ResponseTransactionStatus || 'N/A').trim();
    const normalized = raw.toLowerCase();
    let status: MpesaQueryResult['status'] = 'N/A';
    if (normalized === 'completed') status = 'Completed';
    else if (normalized === 'pending') status = 'Pending';
    else if (normalized === 'cancelled') status = 'Cancelled';
    else if (normalized === 'expired') status = 'Expired';
    else if (normalized === 'failed') status = 'Failed';
    else if (normalized === 'n/a') status = 'N/A';

    return {
      status,
      responseCode: response.output_ResponseCode,
      responseDesc: response.output_ResponseDesc,
      conversationId: response.output_ConversationID,
      simulated: false,
    };
  }
}
