export class PaysuiteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaysuiteValidationError';
  }
}

export class PaysuiteApiError extends Error {
  readonly statusCode: number;
  readonly body: unknown;

  constructor(message: string, statusCode: number, body?: unknown) {
    super(message);
    this.name = 'PaysuiteApiError';
    this.statusCode = statusCode;
    this.body = body;
  }
}
