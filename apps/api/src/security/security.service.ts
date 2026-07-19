import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FindingStatus, Prisma, VulnSeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../reliability/outbox.service';
import { ProjectionService } from '../reliability/projection.service';
import { RELIABILITY_RULES } from '../reliability/rules';
import {
  SECURITY_CATALOG,
  SECURITY_RULES,
  type SecurityCheckContext,
} from './rules';

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly outbox: OutboxService,
    private readonly projections: ProjectionService,
  ) {}

  private context(): SecurityCheckContext {
    const nodeEnv = this.config.get<string>('NODE_ENV', 'development');
    const webUrl = this.config.get<string>('WEB_URL');
    const appUrl = this.config.get<string>('APP_URL');
    const httpsEnforced =
      Boolean(webUrl?.startsWith('https://')) &&
      Boolean(appUrl?.startsWith('https://'));

    return {
      nodeEnv,
      jwtSecret: this.config.get<string>('JWT_SECRET'),
      paysuiteToken: this.config.get<string>('PAYSUITE_TOKEN')?.trim(),
      paysuiteWebhookSecret: this.config
        .get<string>('PAYSUITE_WEBHOOK_SECRET')
        ?.trim(),
      corsOrigin: this.config.get<string>('CORS_ORIGIN'),
      webUrl,
      appUrl,
      httpsEnforced,
    };
  }

  async syncSystem() {
    const ctx = this.context();
    const simulate =
      this.config.get<string>('PAYSUITE_SIMULATE') === 'true' &&
      ctx.nodeEnv === 'production';

    const results: Array<{
      code: string;
      severity: VulnSeverity;
      ok: boolean;
      status: FindingStatus;
    }> = [];

    for (const entry of SECURITY_CATALOG) {
      let ok = await entry.check(ctx);
      if (entry.code === 'SEC-LOW-002') {
        ok = !simulate;
      }

      if (ok) {
        await this.prisma.securityFinding.upsert({
          where: {
            code_surface: { code: entry.code, surface: entry.surface },
          },
          create: {
            code: entry.code,
            severity: entry.severity,
            title: entry.title,
            description: entry.description,
            surface: entry.surface,
            remediation: entry.remediation,
            status: FindingStatus.CLOSED,
            resolvedAt: new Date(),
            evidence: { ok: true, checkedAt: new Date().toISOString() },
          },
          update: {
            status: FindingStatus.CLOSED,
            resolvedAt: new Date(),
            evidence: { ok: true, checkedAt: new Date().toISOString() },
          },
        });
        results.push({
          code: entry.code,
          severity: entry.severity,
          ok: true,
          status: FindingStatus.CLOSED,
        });
      } else {
        await this.prisma.securityFinding.upsert({
          where: {
            code_surface: { code: entry.code, surface: entry.surface },
          },
          create: {
            code: entry.code,
            severity: entry.severity,
            title: entry.title,
            description: entry.description,
            surface: entry.surface,
            remediation: entry.remediation,
            status: FindingStatus.OPEN,
            evidence: { ok: false, checkedAt: new Date().toISOString() },
          },
          update: {
            status: FindingStatus.OPEN,
            resolvedAt: null,
            description: entry.description,
            remediation: entry.remediation,
            evidence: { ok: false, checkedAt: new Date().toISOString() },
          },
        });
        results.push({
          code: entry.code,
          severity: entry.severity,
          ok: false,
          status: FindingStatus.OPEN,
        });
        this.logger.warn(
          `Security finding OPEN ${entry.severity} ${entry.code}: ${entry.title}`,
        );
      }
    }

    const open = results.filter((r) => !r.ok);
    const summary = {
      checkedAt: new Date().toISOString(),
      total: results.length,
      open: open.length,
      bySeverity: {
        CRITICAL: open.filter((r) => r.severity === VulnSeverity.CRITICAL)
          .length,
        HIGH: open.filter((r) => r.severity === VulnSeverity.HIGH).length,
        MEDIUM: open.filter((r) => r.severity === VulnSeverity.MEDIUM).length,
        LOW: open.filter((r) => r.severity === VulnSeverity.LOW).length,
      },
      shipBlocked: open.some(
        (r) =>
          r.severity === VulnSeverity.HIGH ||
          r.severity === VulnSeverity.CRITICAL,
      ),
      rules: {
        country: SECURITY_RULES.compliance.country,
        currency: SECURITY_RULES.compliance.currency,
        sla: SECURITY_RULES.vulnerabilitySla,
      },
      findings: results,
    };

    await this.projections.upsert(
      RELIABILITY_RULES.projections.names.platformSecuritySync,
      'global',
      summary,
    );

    await this.outbox.enqueue({
      aggregateType: 'security',
      aggregateId: 'global',
      eventType: 'security.sync.completed',
      payload: summary,
    });

    return summary;
  }

  async listFindings(status?: FindingStatus) {
    return this.prisma.securityFinding.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
    });
  }

  async acknowledge(id: string) {
    return this.prisma.securityFinding.update({
      where: { id },
      data: {
        status: FindingStatus.ACKNOWLEDGED,
        evidence: {
          acknowledgedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
  }

  complianceSnapshot() {
    return {
      ...SECURITY_RULES.compliance,
      headers: SECURITY_RULES.headers,
      payments: {
        provider: SECURITY_RULES.payments.provider,
        currency: SECURITY_RULES.payments.currency,
        webhookSignatureRequired:
          SECURITY_RULES.payments.webhookSignatureRequired,
      },
      rateLimit: SECURITY_RULES.rateLimit,
      vulnerabilitySla: SECURITY_RULES.vulnerabilitySla,
    };
  }
}
