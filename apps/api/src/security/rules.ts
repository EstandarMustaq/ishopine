import { VulnSeverity } from '@prisma/client';

/**
 * iShopine — rigid security & compliance rules.
 * Severity policy: HIGH/CRITICAL block ship; MEDIUM require ticket; LOW tracked.
 */
export const SECURITY_RULES = {
  headers: {
    required: [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'Content-Security-Policy',
    ] as const,
    hstsInProduction: true,
  },
  auth: {
    jwtMinSecretLength: 32,
    requireHttpsInProduction: true,
    totpRequiredRoles: [
      'SELLER',
      'PLATFORM_OPERATOR',
      'PLATFORM_ADMIN',
    ] as const,
  },
  payments: {
    provider: 'PAYSUITE' as const,
    currency: 'MZN' as const,
    webhookSignatureRequired: true,
    /** Never log full MSISDN / tokens */
    redactFields: [
      'msisdn',
      'Authorization',
      'PAYSUITE_TOKEN',
      'JWT_SECRET',
      'password',
    ] as const,
  },
  rateLimit: {
    globalPerMinute: 120,
    authPerMinute: 20,
    webhookPerMinute: 300,
  },
  vulnerabilitySla: {
    CRITICAL: { acknowledgeHours: 4, mitigateHours: 24 },
    HIGH: { acknowledgeHours: 24, mitigateHours: 72 },
    MEDIUM: { acknowledgeHours: 72, mitigateHours: 336 },
    LOW: { acknowledgeHours: 168, mitigateHours: 720 },
  } satisfies Record<
    VulnSeverity,
    { acknowledgeHours: number; mitigateHours: number }
  >,
  compliance: {
    country: 'MZ',
    currency: 'MZN',
    dataResidencyNote: 'Prefer MZ/AF or EU with DPA for personal data',
    webhookIdempotencyRequired: true,
    auditSensitiveActions: true,
  },
} as const;

export type SecurityCatalogEntry = {
  code: string;
  severity: VulnSeverity;
  title: string;
  description: string;
  surface: string;
  remediation: string;
  check: (ctx: SecurityCheckContext) => boolean | Promise<boolean>;
};

export type SecurityCheckContext = {
  nodeEnv: string;
  jwtSecret?: string;
  paysuiteToken?: string;
  paysuiteWebhookSecret?: string;
  corsOrigin?: string;
  webUrl?: string;
  appUrl?: string;
  httpsEnforced: boolean;
};

/** Built-in catalog — sync creates/updates findings from these checks */
export const SECURITY_CATALOG: SecurityCatalogEntry[] = [
  {
    code: 'SEC-HIGH-001',
    severity: VulnSeverity.HIGH,
    title: 'JWT secret fraco ou em falta',
    description: 'JWT_SECRET deve ter pelo menos 32 caracteres em produção.',
    surface: 'auth',
    remediation: 'Definir JWT_SECRET forte via secret manager.',
    check: (ctx) =>
      ctx.nodeEnv !== 'production' ||
      Boolean(ctx.jwtSecret && ctx.jwtSecret.length >= 32),
  },
  {
    code: 'SEC-HIGH-002',
    severity: VulnSeverity.HIGH,
    title: 'PaySuite webhook secret em falta',
    description:
      'Sem PAYSUITE_WEBHOOK_SECRET, callbacks podem ser forjados (HIGH).',
    surface: 'billing',
    remediation: 'Configurar PAYSUITE_WEBHOOK_SECRET do painel PaySuite.',
    check: (ctx) =>
      ctx.nodeEnv !== 'production' || Boolean(ctx.paysuiteWebhookSecret),
  },
  {
    code: 'SEC-HIGH-003',
    severity: VulnSeverity.HIGH,
    title: 'PaySuite token em falta em produção',
    description: 'Cobranças reais requerem PAYSUITE_TOKEN.',
    surface: 'billing',
    remediation: 'Obter token em Settings → API Access (paysuite.tech).',
    check: (ctx) => ctx.nodeEnv !== 'production' || Boolean(ctx.paysuiteToken),
  },
  {
    code: 'SEC-MED-001',
    severity: VulnSeverity.MEDIUM,
    title: 'CORS aberto ou wildcard',
    description: 'CORS_ORIGIN não deve ser * em produção.',
    surface: 'api',
    remediation: 'Restringir CORS_ORIGIN ao domínio ishopine.com.',
    check: (ctx) =>
      ctx.nodeEnv !== 'production' ||
      Boolean(ctx.corsOrigin && ctx.corsOrigin !== '*'),
  },
  {
    code: 'SEC-MED-002',
    severity: VulnSeverity.MEDIUM,
    title: 'HTTPS não reforçado',
    description: 'WEB_URL/APP_URL devem usar https em produção.',
    surface: 'api',
    remediation: 'Usar https:// nas URLs públicas e HSTS.',
    check: (ctx) => ctx.nodeEnv !== 'production' || ctx.httpsEnforced,
  },
  {
    code: 'SEC-LOW-001',
    severity: VulnSeverity.LOW,
    title: 'APP_URL local em desenvolvimento',
    description: 'APP_URL aponta para localhost (esperado em dev).',
    surface: 'ops',
    remediation: 'Em produção definir APP_URL público.',
    check: (ctx) =>
      ctx.nodeEnv === 'production'
        ? Boolean(ctx.appUrl && !ctx.appUrl.includes('localhost'))
        : true,
  },
  {
    code: 'SEC-LOW-002',
    severity: VulnSeverity.LOW,
    title: 'Simulação PaySuite activa',
    description: 'PAYSUITE_SIMULATE não deve estar activo em produção.',
    surface: 'billing',
    remediation: 'Remover PAYSUITE_SIMULATE em produção.',
    check: () => true, // evaluated in security.service with env
  },
];
